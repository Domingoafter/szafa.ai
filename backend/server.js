// Wczytujemy zmienne z pliku .env (w tym OPENAI_API_KEY)
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
    // Zamieniamy zdjęcie na base64, żeby przekazać je do AI
    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const prompt = `
Na podstawie zdjęcia opisz JEDNO główne ubranie widoczne na zdjęciu.
Napisz po polsku, w jednym krótkim zdaniu, w takiej formie:
"czarne skórzane botki na słupku, jesienno-zimowe, w stylu casual-rock".

Uwzględnij:
- typ ubrania (np. botki, płaszcz, sukienka, spodnie),
- kolor,
- ewentualnie materiał/fason (np. oversize, dopasowana, skórzane),
- porę roku (np. wiosna, lato, jesień-zima),
- styl (np. elegancki, casual, sportowy, basic).

Nie dodawaj żadnych dodatkowych komentarzy, nagłówków ani list.
Tylko jedno zdanie-opis ubrania, bez emotek.
    `.trim();

    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini", // możesz zmienić na "gpt-4o" albo inny model z vision
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
    });

    const text =
      aiResponse.output_text ||
      "Nie udało się odczytać opisu ubrania ze zdjęcia.";

    return res.json({
      description: text,
    });
  } catch (error) {
    console.error("Błąd przy analizie zdjęcia:", error);
    return res.status(500).json({
      description:
        "Nie udało się przeanalizować zdjęcia. Sprawdź limity API lub spróbuj ponownie później.",
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
      // na razie bierzemy tylko pierwsze zdjęcie inspo
      const firstFile = req.files[0];
      const base64Image = firstFile.buffer.toString("base64");
      const imageUrl = `data:${firstFile.mimetype};base64,${base64Image}`;

      const prompt = `
Na podstawie przesłanego zdjęcia inspiracji opisz styl, kolorystykę i vibe użytkowniczki.

Napisz po polsku, zwięźle, w kilku krótkich częściach:

1) STYL / VIBE – 1–2 zdania (np. "minimalistyczny, elegancki, z nutą francuskiego chic").
2) KOLORYSTYKA – 1–2 zdania (dominujące kolory, raczej ciepłe/chłodne, kontrast czy stonowanie).
3) FASONY – 1–2 zdania (np. oversize, dopasowane, proste kroje, luźne, podkreślające talię).
4) OKAZJE – 1–2 zdania (do jakich sytuacji pasuje taki styl: praca, miasto, randka, codzienność).

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
  const { wardrobe, preferences, styleProfile,weather } = req.body;


  // jeśli nie ma ubrań – nie wołamy AI
  if (!wardrobe || wardrobe.length === 0) {
    return res.json({
      description: "Dodaj najpierw ubrania, by wygenerować stylizację.",
      imageUrl: null,
    });
  }

// przygotowanie tekstu z garderoby, preferencji i inspiracji
const wardrobeText = wardrobe.join("; ");
const preferencesText =
  preferences && preferences.length > 0
    ? preferences.join(", ")
    : "brak szczególnych preferencji (traktuj jako styl codzienny)";
const styleProfileText =
  styleProfile && styleProfile.length > 0
    ? styleProfile
    : "brak analizy zdjęć inspiracji (przyjmij neutralny styl)";

// NOWE: opis pogody na potrzeby promptu
let weatherText = "brak informacji o pogodzie (przyjmij neutralne warunki).";

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


// prompt po polsku – pełna instrukcja dla AI
const prompt = `
Jesteś wirtualną stylistką w aplikacji "Szafa AI". Twoim zadaniem jest stworzenie stylizacji wyłącznie na podstawie garderoby użytkowniczki.

GARDEROBA (rzeczy, które użytkowniczka faktycznie posiada):
${wardrobeText}

PREFERENCJE (to, co użytkowniczka wpisała ręcznie):
${preferencesText}

STYL NA PODSTAWIE ZDJĘĆ INSPIRACJI (analiza Vision):
${styleProfileText}

WARUNKI POGODOWE(BARDZO WAŻNE):
${weatherText}

ZASADY:
1. Stylizacja MUSI BYĆ REALISTYCZNA I PRAKTYCZNA dla powyższych warunków pogodowych. 
   - Jeśli temperatura jest poniżej 10°C lub występuje deszcz/śnieg/wiatr, uwzględnij cieplejsze warstwy, zakryte buty, okrycie wierzchnie.
   - Jeśli temperatura jest powyżej 20°C lub upał – lekkie tkaniny, przewiewne fasony, brak ciężkich zimowych elementów.
2. Używaj WYŁĄCZNIE elementów z garderoby. Nie wymyślaj nowych ubrań, kolorów ani fasonów spoza listy.
3. Jeśli w garderobie brakuje czegoś ważnego (np. butów na deszcz), NIE dodawaj tego do stylizacji. Zapisz to tylko w sekcji "BRAKI W SZAFIE" jako ogólną sugestię.
4. Dopasuj stylizację do preferencji użytkowniczki i stylu z inspiracji, ale nie łam zasad pogodowych.
5. Pisz po polsku, przyjaznym tonem, bez emoji.

FORMAT ODPOWIEDZI:
STYLIZACJA NA DZIŚ:
- Krótki opis ogólny (1–2 zdania).

ELEMENTY STYLIZACJI:
- wypunktowana lista elementów z garderoby (dokładnie tak, jak zapisane są powyżej), z krótkim uzasadnieniem dlaczego pasują.

OKAZJA:
- 1 zdanie, do jakiej sytuacji ta stylizacja pasuje najlepiej.

POGODA A STYLIZACJA:
- 1–2 zdania wyjaśniające, dlaczego ten zestaw jest odpowiedni przy: ${weatherText}.

BRAKI W SZAFIE:
- 1–3 zdania z sugestią, jakich TYPÓW ubrań brakuje (np. "brakuje wodoodpornej kurtki"), aby mieć więcej możliwości – to nie są elementy stylizacji, tylko rekomendacje zakupowe.

TIP STYLISTKI:
- 1–2 zdania z poradą personalizowaną do użytkowniczki i jej stylu.
`;


  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-5.1",
      input: prompt,
    });

    // Proste wyciągnięcie tekstu z odpowiedzi
    let text = "Nie udało się odczytać odpowiedzi AI.";

    if (
      aiResponse.output &&
      Array.isArray(aiResponse.output) &&
      aiResponse.output[0] &&
      aiResponse.output[0].content &&
      Array.isArray(aiResponse.output[0].content) &&
      aiResponse.output[0].content[0] &&
      aiResponse.output[0].content[0].text
    ) {
      text = aiResponse.output[0].content[0].text;
    }

    // 🔹 Generowanie obrazu stylizacji (tryb A – neutralna postać)
        let imageUrl = null;
    try {
      const shortText = text.slice(0, 400); // skracamy opis, żeby prompt był prostszy

      const imageResponse = await openai.images.generate({
        model: "gpt-image-1",
prompt: `
Stylizacja ubraniowa na pełną sylwetkę.

UWZGLĘDNIJ WARUNKI POGODOWE:
- ${weatherText}

UWZGLĘDNIJ OPIS STYLIZACJI:
${shortText}

Zasady:
- ubiór musi być adekwatny do podanych warunków pogodowych,
- neutralna postać,
- realistyczne proporcje ciała,
- tło proste lub rozmyte.
`.trim(),

        size: "1024x1024",
        // domyślne response_format to "b64_json" – nie podajemy już tu parametru
      });

      if (imageResponse.data && imageResponse.data[0] && imageResponse.data[0].b64_json) {
        const base64 = imageResponse.data[0].b64_json;
        // budujemy data URL, który przeglądarka potrafi wyświetlić jak zwykły obraz
        imageUrl = `data:image/png;base64,${base64}`;
      }
    } catch (imgError) {
      console.error("Błąd przy generowaniu obrazu stylizacji:", imgError);
      // imageUrl zostaje null – frontend pokaże placeholder
    }



    return res.json({
      description: text,
      imageUrl,
    });
  } catch (error) {
    console.error("Błąd przy wywołaniu OpenAI:", error);
    return res.status(500).json({
      description:
        "Wystąpił błąd po stronie AI. Spróbuj ponownie za chwilę.",
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
1. Jakich kluczowych elementów brakuje w szafie? (np. obuwie, okrycia wierzchnie, bazowe topy, dodatki)
2. Podziel braki na przejrzyste kategorie (np. Elegant / Basic / Outdoor / Footwear / Accessories).
3. Dla każdej kategorii wypisz 2–4 propozycje elementów, które rozszerzyłyby możliwości stylizacyjne.
4. Pisz po polsku, krótko, konkretnie, bez wymyślania szczegółowych modeli.

FORMAT ODPOWIEDZI:
BRYKI W SZAFIE:
- punktowo

KATEGORIE:
- Kategoria: propozycje

SUGESTIE ZAKUPOWE:
- ogólne wskazówki, czego warto szukać (bez konkretnych linków)
`;

  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-5.1",
      input: prompt,
    });

    let text =
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
  const { gaps, budgetPerItem, currency, country, preferredStore } = req.body;

  // gaps = lista braków w szafie (np. ["biała koszulka basic", "proste jeansy"])
  if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
    return res
      .status(400)
      .json({ error: "Brak listy braków w szafie (gaps)." });
  }

  const store = preferredStore || "Reserved";
  const curr = currency || "PLN";

  // Na MVP zakładamy Polskę i PL wersję Reserved
  const baseSearchUrl = "https://www.reserved.com/pl/pl/search?searchPhrase=";

  const suggestions = gaps.map((gap) => {
    const query = encodeURIComponent(gap);
    const searchUrl = `${baseSearchUrl}${query}`;

    return {
      gap,                       // czego szukamy (np. "biała koszulka basic")
      store,                     // "Reserved"
      approxPrice: budgetPerItem || null,
      currency: curr,
      searchUrl,                 // link do wyszukiwarki Reserved
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

// Uruchamiamy serwer
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

