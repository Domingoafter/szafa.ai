// 🔹 Walidacja logiki outfitu
function validateOutfit(selectedItems) {
  const categories = selectedItems.map((item) => item.category);

  const hasDress = categories.includes("dress");
  const hasBottom = categories.includes("bottom");
  const hasTop = categories.includes("top");

  const bottomCount = categories.filter((c) => c === "bottom").length;
  const topCount = categories.filter((c) => c === "top").length;
  const dressCount = categories.filter((c) => c === "dress").length;
  const outerwearCount = categories.filter((c) => c === "outerwear").length;

  const errors = [];

  if (hasDress && hasBottom)
    errors.push("Sukienka nie może być łączona ze spódnicą lub spodniami.");
  if (hasDress && hasTop)
    errors.push("Sukienka nie może być łączona z topem lub koszulą.");
  if (bottomCount > 1)
    errors.push("Nie można wybrać dwóch elementów z kategorii bottom.");
  if (topCount > 1)
    errors.push("Nie można wybrać dwóch elementów z kategorii top.");
  if (dressCount > 1)
    errors.push("Nie można wybrać dwóch sukienek.");
  if (outerwearCount > 1)
    errors.push("Nie można wybrać dwóch okryć wierzchnich.");

  // Musi być albo sukienka, albo top + bottom
  if (!hasDress && !hasBottom && !hasTop)
    errors.push("Outfit musi zawierać top + bottom lub sukienkę.");

  return errors;
}

// 🔹 Endpoint z AI – generowanie stylizacji
app.post("/api/generate-outfit", async (req, res) => {
  const { wardrobe, preferences, styleProfile, weather, gender } = req.body;

  if (!wardrobe || wardrobe.length === 0) {
    return res.json({
      description: "Dodaj najpierw ubrania, by wygenerować stylizację.",
      imageUrl: null,
      selectedItems: [],
      occasion: "",
      missing: "",
      tip: "",
    });
  }

  // Podział garderoby na kategorie
  const byCategory = {
    tops: wardrobe.filter((i) => i.category === "top"),
    bottoms: wardrobe.filter((i) => i.category === "bottom"),
    dresses: wardrobe.filter((i) => i.category === "dress"),
    outerwear: wardrobe.filter((i) => i.category === "outerwear"),
    shoes: wardrobe.filter((i) => i.category === "shoes"),
    bags: wardrobe.filter((i) => i.category === "bag"),
    accessories: wardrobe.filter((i) => i.category === "accessory"),
  };

  const wardrobeCatalog = wardrobe.map((item) => ({
    id: item.id,
    name: item.name || "unknown",
    category: item.category || "unknown",
    color: item.color || "unknown",
    season: item.season || "unknown",
  }));

  const formatList = (items) =>
    items.length > 0
      ? items.map((i) => `  id=${i.id} | ${i.name} | ${i.color} | ${i.season}`).join("\n")
      : "  (brak)";

  const wardrobeText = `
TOPS (góry):
${formatList(byCategory.tops)}

BOTTOMS (doły):
${formatList(byCategory.bottoms)}

DRESSES (sukienki):
${formatList(byCategory.dresses)}

OUTERWEAR (okrycia wierzchnie):
${formatList(byCategory.outerwear)}

SHOES (buty):
${formatList(byCategory.shoes)}

BAGS (torebki):
${formatList(byCategory.bags)}

ACCESSORIES (dodatki):
${formatList(byCategory.accessories)}
`.trim();

  const genderText = gender === "male" ? "mężczyzna" : gender === "female" ? "kobieta" : "osoba";

  const preferencesText =
    preferences?.length > 0 ? preferences.join(", ") : "brak szczególnych preferencji";

  const styleProfileText =
    styleProfile?.length > 0 ? styleProfile : "brak analizy inspiracji";

  let weatherText = "brak informacji o pogodzie";
  if (weather) {
    const parts = [];
    if (typeof weather.temperatureC === "number" && !Number.isNaN(weather.temperatureC))
      parts.push(`temperatura około ${weather.temperatureC}°C`);
    if (weather.condition) parts.push(`warunki: ${weather.condition}`);
    if (parts.length > 0) weatherText = parts.join(", ");
  }

  const hasDresses = byCategory.dresses.length > 0;
  const hasTopsAndBottoms = byCategory.tops.length > 0 && byCategory.bottoms.length > 0;

  let outfitRule = "";
  if (hasDresses && hasTopsAndBottoms) {
    outfitRule = `REGUŁA OUTFITU: Wybierz ALBO jedną sukienkę z kategorii DRESSES, ALBO jeden top z TOPS + jeden bottom z BOTTOMS. Nigdy nie mieszaj sukienki z topem lub bottomem.`;
  } else if (hasDresses) {
    outfitRule = `REGUŁA OUTFITU: Wybierz jedną sukienkę z kategorii DRESSES.`;
  } else if (hasTopsAndBottoms) {
    outfitRule = `REGUŁA OUTFITU: Wybierz jeden top z TOPS + jeden bottom z BOTTOMS.`;
  } else {
    outfitRule = `REGUŁA OUTFITU: Wybierz dostępne elementy. Jeśli brakuje kluczowych części outfitu, napisz to w polu "missing".`;
  }

  const prompt = `
Jesteś wirtualną stylistką w aplikacji "Szafa AI".
Tworzysz stylizację dla: ${genderText}.

${outfitRule}

Możesz DODATKOWO dodać (opcjonalnie, max 1 z każdej):
- okrycie wierzchnie z OUTERWEAR (jeśli pasuje do pogody)
- buty z SHOES
- torebkę z BAGS
- dodatek z ACCESSORIES

GARDEROBA:
${wardrobeText}

Preferencje: ${preferencesText}
Styl z inspiracji: ${styleProfileText}
Pogoda: ${weatherText}

ZASADY:
- Używaj WYŁĄCZNIE ID z powyższej listy.
- Nie wymyślaj ubrań spoza listy.
- selectedItemIds = tablica ID wybranych ubrań.
- Jeśli czegoś brakuje do kompletnego outfitu, napisz w "missing".
- Odpowiedz WYŁĄCZNIE czystym JSON, bez markdowna.

Format:
{
  "selectedItemIds": [1, 2],
  "description": "...",
  "occasion": "...",
  "missing": "...",
  "tip": "..."
}
`.trim();

  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text =
      aiResponse.output_text ||
      '{"selectedItemIds":[],"description":"Nie udało się wygenerować stylizacji.","occasion":"","missing":"","tip":""}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Nie udało się sparsować JSON stylizacji:", text);
      return res.status(500).json({
        description: "AI zwróciło niepoprawny format odpowiedzi.",
        imageUrl: null,
        selectedItems: [],
        occasion: "",
        missing: "",
        tip: "",
        raw: text,
      });
    }

    const selectedIds = Array.isArray(parsed.selectedItemIds) ? parsed.selectedItemIds : [];

    // Mapujemy ID → obiekty
    const selectedItemObjects = wardrobeCatalog.filter((item) =>
      selectedIds.includes(item.id)
    );

    // ✅ Walidacja logiki outfitu po stronie backendu
    const validationErrors = validateOutfit(selectedItemObjects);

    if (validationErrors.length > 0) {
      console.warn("Walidacja outfitu nie przeszła:", validationErrors);
      return res.status(422).json({
        description: "AI wygenerowało niepoprawną stylizację. Spróbuj ponownie.",
        imageUrl: null,
        selectedItems: [],
        occasion: "",
        missing: validationErrors.join(" "),
        tip: "Spróbuj ponownie – AI dobierze lepszą kombinację.",
        validationErrors,
      });
    }

    const selectedItems = selectedItemObjects.map((item) => item.name);

    return res.json({
      selectedItems,
      description: parsed.description || "Brak opisu stylizacji.",
      occasion: parsed.occasion || "",
      missing: parsed.missing || "",
      tip: parsed.tip || "",
      imageUrl: null,
    });
  } catch (error) {
    console.error("Błąd przy wywołaniu OpenAI:", error);
    return res.status(500).json({
      description: "Wystąpił błąd po stronie AI. Spróbuj ponownie za chwilę.",
      imageUrl: null,
      selectedItems: [],
      occasion: "",
      missing: "",
      tip: "",
    });
  }
});