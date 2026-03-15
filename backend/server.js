// Wczytujemy zmienne z pliku .env (w tym OPENAI_API_KEY)
const { pool } = require("./db");
const requireAuth = require("./requireAuth");

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Serwujemy pliki frontendu (index.html, style.css, script.js) z katalogu głównego projektu
app.use(express.static(path.join(__dirname, "..")));

// Klient OpenAI – używa klucza z .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔹 Prosty endpoint testowy – do sprawdzenia backendu
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend działa!" });
});

// 🔹 Endpoint do analizy jednego zdjęcia (AI Vision – prawdziwy opis)
app.post("/api/analyze-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Brak zdjęcia do analizy" });
  }

  try {
    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const prompt = `
Opisz jedno główne ubranie widoczne na zdjęciu.

Zasady:
- pisz tylko o tym, co naprawdę widać,
- nie zgaduj,
- jeśli coś jest niepewne, pomiń to,
- odpowiedz jednym krótkim zdaniem po polsku.

Format:
kolor + typ ubrania + ewentualnie materiał/fason + ewentualnie sezon/styl

Przykład:
"czarna skórzana kurtka, styl rockowy"
`.trim();

    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
    });

    const text =
      aiResponse.output_text || "Nie udało się odczytać opisu ubrania.";

    return res.json({
      description: text,
    });
  } catch (error) {
    console.error("Błąd przy analizie zdjęcia:", error);
    return res.status(500).json({
      error: "Nie udało się przeanalizować zdjęcia.",
    });
  }
});

// 🔹 Endpoint do analizy inspiracji (zdjęcia stylu)
app.post(
  "/api/analyze-style-images",
  upload.array("images", 5),
  async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Brak zdjęć inspiracji" });
    }

    try {
      const firstFile = req.files[0];
      const base64Image = firstFile.buffer.toString("base64");
      const imageUrl = `data:${firstFile.mimetype};base64,${base64Image}`;

      const prompt = `
Na podstawie przesłanego zdjęcia inspiracji opisz styl, kolorystykę i vibe użytkowniczki.

Napisz po polsku, zwięźle, w kilku krótkich częściach:

1) STYL / VIBE – 1–2 zdania.
2) KOLORYSTYKA – 1–2 zdania.
3) FASONY – 1–2 zdania.
4) OKAZJE – 1–2 zdania.

Bez emoji, bez nagłówków typu "Odpowiedź:".
      `.trim();

      const aiResponse = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageUrl },
            ],
          },
        ],
      });

      const text =
        aiResponse.output_text ||
        "Nie udało się odczytać stylu z inspiracji.";

      return res.json({
        styleProfile: text,
      });
    } catch (error) {
      console.error("Błąd przy analizie inspiracji:", error);
      return res.status(500).json({
        styleProfile:
          "Nie udało się przeanalizować inspiracji. Spróbuj ponownie później.",
      });
    }
  }
);

// 🔹 Endpoint z AI – generowanie stylizacji
app.post("/api/generate-outfit", async (req, res) => {
  const { wardrobe, preferences, styleProfile, weather, gender } = req.body;

  if (!wardrobe || wardrobe.length === 0) {
    return res.json({
      description: "Dodaj najpierw ubrania, by wygenerować stylizację.",
      imageUrl: null,
    });
  }

  const wardrobeText = wardrobe.join("; ");

  const preferencesText =
    preferences && preferences.length > 0
      ? preferences.join(", ")
      : "brak szczególnych preferencji";

  const styleProfileText =
    styleProfile && styleProfile.length > 0
      ? styleProfile
      : "brak analizy inspiracji";

  const genderText =
    gender === "male"
      ? "mężczyzna"
      : gender === "female"
      ? "kobieta"
      : "osoba";

  let weatherText = "brak informacji o pogodzie";

  if (weather) {
    const parts = [];

    if (
      typeof weather.temperatureC === "number" &&
      !Number.isNaN(weather.temperatureC)
    ) {
      parts.push(`temperatura około ${weather.temperatureC}°C`);
    }

    if (weather.condition) {
      parts.push(`warunki: ${weather.condition}`);
    }

    if (parts.length > 0) {
      weatherText = parts.join(", ");
    }
  }

  const prompt = `
Jesteś wirtualną stylistką w aplikacji "Szafa AI".

Tworzysz stylizację dla: ${genderText}.

Masz używać WYŁĄCZNIE ubrań z tej garderoby:
${wardrobeText}

Preferencje użytkownika:
${preferencesText}

Styl z inspiracji:
${styleProfileText}

Warunki pogodowe:
${weatherText}

Zasady:
1. Nie wymyślaj nowych ubrań.
2. Używaj tylko elementów z listy garderoby.
3. Stylizacja ma być praktyczna do pogody.
4. Jeśli czegoś brakuje, wpisz to tylko w sekcji "Braki".
5. Odpowiedz krótko i konkretnie po polsku.

Format odpowiedzi:

STYLIZACJA:
1-2 zdania opisu.

ELEMENTY:
- lista konkretnych elementów z garderoby

OKAZJA:
1 zdanie

BRAKI:
1-2 zdania

TIP:
1 zdanie
`.trim();

  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text =
      aiResponse.output?.[0]?.content?.[0]?.text ||
      "Nie udało się odczytać odpowiedzi AI.";

    return res.json({
      description: text,
      imageUrl: null,
    });
  } catch (error) {
    console.error("Błąd przy wywołaniu OpenAI:", error);
    return res.status(500).json({
      description: "Wystąpił błąd po stronie AI. Spróbuj ponownie za chwilę.",
      imageUrl: null,
    });
  }
});

// 🔹 Nowy endpoint – analiza braków w szafie
app.post("/api/wardrobe-gaps", async (req, res) => {
  const { wardrobe } = req.body;

  if (!wardrobe || wardrobe.length === 0) {
    return res.status(400).json({
      gaps: "Brak ubrań – nie można przeprowadzić analizy braków.",
    });
  }

  const wardrobeText = wardrobe.join("; ");

  const prompt = `
Jesteś profesjonalną wirtualną stylistką w aplikacji modowej.
Twoim zadaniem jest przeanalizowanie garderoby użytkowniczki i wskazanie braków.

GARDEROBA:
${wardrobeText}

OCEŃ:
1. Jakich kluczowych elementów brakuje w szafie?
2. Podziel braki na przejrzyste kategorie.
3. Dla każdej kategorii wypisz 2–4 propozycje elementów.
4. Pisz po polsku, krótko i konkretnie.

FORMAT ODPOWIEDZI:
BRAKI W SZAFIE:
- punktowo

KATEGORIE:
- Kategoria: propozycje

SUGESTIE ZAKUPOWE:
- ogólne wskazówki
`;

  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text =
      aiResponse.output?.[0]?.content?.[0]?.text ||
      "Nie udało się przeanalizować braków.";

    return res.json({
      gaps: text,
    });
  } catch (error) {
    console.error("Błąd przy analizie braków:", error);
    return res.status(500).json({
      gaps: "Wystąpił błąd podczas analizy braków.",
    });
  }
});

// 🔹 Propozycje zakupów – na razie: linki do wyszukiwarki Reserved
app.post("/api/shop-suggestions", (req, res) => {
  const { gaps, budgetPerItem, currency, preferredStore } = req.body;

  if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
    return res
      .status(400)
      .json({ error: "Brak listy braków w szafie (gaps)." });
  }

  const store = preferredStore || "Reserved";
  const curr = currency || "PLN";
  const baseSearchUrl = "https://www.reserved.com/pl/pl/search?searchPhrase=";

  const suggestions = gaps.map((gap) => {
    const query = encodeURIComponent(gap);
    const searchUrl = `${baseSearchUrl}${query}`;

    return {
      gap,
      store,
      approxPrice: budgetPerItem || null,
      currency: curr,
      searchUrl,
      note:
        "To jest link do wyszukiwania w Reserved na podstawie tego, czego szukasz. Możesz go doprecyzować bezpośrednio na stronie sklepu.",
    };
  });

  return res.json({ suggestions });
});

// Fallback: jeśli ktoś wejdzie na "/" i statyczne pliki nie zadziałają,
// wyślij po prostu index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `insert into users (id, email)
       values ($1, $2)
       on conflict (id) do update set email = excluded.email`,
      [req.user.uid, req.user.email || null]
    );

    res.json({ uid: req.user.uid, email: req.user.email });
  } catch (error) {
    console.error("Błąd GET /api/me:", error);
    res.status(500).json({
      error: "Nie udało się zsynchronizować użytkownika",
      details: error.message,
    });
  }
});

// Uruchamiamy serwer
const PORT = process.env.PORT || 3001;

app.post("/api/garments", requireAuth, async (req, res) => {
  try {
    const { name, category, color, season } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brak nazwy" });
    }

    // upewnij się, że user istnieje w tabeli users
    await pool.query(
      `insert into users (id, email)
       values ($1, $2)
       on conflict (id) do update set email = excluded.email`,
      [req.user.uid, req.user.email || null]
    );

    const result = await pool.query(
      `insert into garments (user_id, name, category, color, season)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [req.user.uid, name, category || null, color || null, season || null]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Błąd POST /api/garments:", error);
    return res.status(500).json({
      error: "Nie udało się zapisać ubrania",
      details: error.message,
    });
  }
});

app.get("/api/garments", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `select * from garments where user_id = $1 order by created_at desc`,
      [req.user.uid]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Błąd GET /api/garments:", error);
    return res.status(500).json({
      error: "Nie udało się pobrać garderoby",
      details: error.message,
    });
  }
});
app.post("/api/analyze-garment", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Brak zdjęcia ubrania" });
  }

  try {
    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const prompt = `
Przeanalizuj jedno główne ubranie widoczne na zdjęciu.

Zwróć odpowiedź WYŁĄCZNIE w czystym JSON-ie, bez dodatkowego tekstu.
Nie używaj markdowna.
Nie zgaduj, jeśli czegoś nie widać.

Format odpowiedzi:
{
  "category": "...",
  "color": "...",
  "description": "..."
}

Zasady:
- category = krótka kategoria ubrania po polsku, np. "marynarka", "koszula", "spodnie", "sukienka"
- color = główny kolor po polsku
- description = 1 krótkie zdanie po polsku o fasonie / charakterze ubrania
`.trim();

    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
    });

    const text =
      aiResponse.output_text || '{"category":"nieznane","color":"nieznany","description":"Nie udało się przeanalizować ubrania."}';

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Nie udało się sparsować JSON z AI:", text);
      return res.status(500).json({
        error: "AI zwróciło niepoprawny format odpowiedzi",
        raw: text,
      });
    }

    return res.json({
      category: parsed.category || "nieznane",
      color: parsed.color || "nieznany",
      description: parsed.description || "Brak opisu",
    });
  } catch (error) {
    console.error("Błąd przy analizie ubrania:", error);
    return res.status(500).json({
      error: "Nie udało się przeanalizować ubrania.",
    });
  }
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend działa' });
});
// DELETE garment
app.delete("/api/garments/:id", requireAuth, async (req, res) => {
  try {
    const garmentId = req.params.id;
    const userId = req.user.uid;

    const result = await pool.query(
      `
      DELETE FROM garments
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [garmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Garment not found" });
    }

    res.json({
      success: true,
      deleted: result.rows[0]
    });

  } catch (error) {
    console.error("DELETE GARMENT ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});