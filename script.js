/*
  Ten plik dodaje interaktywność do naszej strony.

  Co robimy:
    - zapisujemy ubrania dodane w formularzu (lista tekstowa),
    - zapisujemy preferencje stylu,
    - obsługujemy wgrywanie zdjęć (ubrania + inspiracje) i pokazujemy miniaturki,
    - zapisujemy garderobę oraz inspiracje w localStorage,
    - po kliknięciu przycisku wysyłamy dane do backendu (garderoba + preferencje + styl + pogoda),
    - backend woła AI i zwraca opis + obraz stylizacji,
    - dodatkowo: analiza braków w szafie.
*/

document.addEventListener("DOMContentLoaded", () => {
  // Formularz i lista garderoby
  const clothesForm = document.getElementById("clothes-form");
  const wardrobeList = document.getElementById("wardrobe-list");

  // Formularz i lista preferencji
  const preferencesForm = document.getElementById("preferences-form");
  const preferencesList = document.getElementById("preferences-list");

  // Przycisk AI i obszary na wynik
  const generateButton = document.getElementById("generate-outfits-button");
  const aiOutput = document.getElementById("ai-output");
  const aiImageArea = document.getElementById("ai-image-area");

    // Zakupy / Reserved
  const gapsInput = document.getElementById("gaps-input");
  const budgetInput = document.getElementById("budget-input");
  const shopButton = document.getElementById("shop-suggestions-button");
  const shopResults = document.getElementById("shop-suggestions-results");

  // Pogoda
  const weatherTempInput = document.getElementById("weather-temp");
  const weatherConditionSelect = document.getElementById("weather-condition");

  // Zdjęcia garderoby
  const wardrobeImagesInput = document.getElementById("wardrobe-images-input");
  const wardrobeImagesPreview = document.getElementById(
    "wardrobe-images-preview"
  );

  // Inspiracje
  const styleImagesInput = document.getElementById("style-images-input");
  const styleImagesPreview = document.getElementById("style-images-preview");
  const analyzeImageButton = document.getElementById(
    "analyze-wardrobe-image-button"
  );
  const analyzeImageResult = document.getElementById(
    "analyze-wardrobe-image-result"
  );
  const analyzeStyleButton = document.getElementById(
    "analyze-style-images-button"
  );
  const analyzeStyleResult = document.getElementById(
    "analyze-style-images-result"
  );
  const clearStyleButton = document.getElementById(
    "clear-style-images-button"
  );

  // 🔹 Przyciski / sekcja „Braki w szafie”
  const checkGapsButton = document.getElementById("check-gaps-button");
  const wardrobeGapsOutput = document.getElementById("wardrobe-gaps-output");

  // 🔹 Nawigacja między „ekranami”
  const navButtons = document.querySelectorAll(".nav-button");

  const screenConfig = {
    wardrobe: [
      "wardrobe-section",
      "wardrobe-images-section",
      "preferences-section",
    ],
    inspirations: ["style-inspo-section"],
    styling: ["ai-section", "shop-section"],
  };

  function showScreen(screenName) {
    const allSectionIds = new Set(Object.values(screenConfig).flat());

    allSectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      if (screenConfig[screenName].includes(id)) {
        el.style.display = "";
      } else {
        el.style.display = "none";
      }
    });

    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.screen === screenName);
    });
  }

  // Podpinamy nawigację tylko jeśli przyciski istnieją
  if (navButtons.length > 0) {
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.screen;
        showScreen(target);
      });
    });
  }

  // -----------------------------
  // GARDEROBA – STAN I LOCALSTORAGE
  // -----------------------------

  let wardrobeState = [];

  function saveWardrobeToStorage() {
    try {
      localStorage.setItem("szafaAI_wardrobe", JSON.stringify(wardrobeState));
    } catch (e) {
      console.error("Nie udało się zapisać garderoby w localStorage:", e);
    }
  }

  function renderWardrobeList() {
    wardrobeList.innerHTML = "";

    wardrobeState.forEach((itemText, index) => {
      const li = document.createElement("li");

      const span = document.createElement("span");
      span.textContent = itemText;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Usuń";
      deleteBtn.className = "delete-garment-button";
      deleteBtn.addEventListener("click", () => {
        // Ubranie usuwamy TYLKO po kliknięciu „Usuń”
        wardrobeState.splice(index, 1);
        saveWardrobeToStorage();
        renderWardrobeList();
      });

      li.appendChild(span);
      li.appendChild(deleteBtn);
      wardrobeList.appendChild(li);
    });
  }

  function loadWardrobeFromStorage() {
    try {
      const raw = localStorage.getItem("szafaAI_wardrobe");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        wardrobeState = parsed;
        renderWardrobeList();
      }
    } catch (e) {
      console.error("Nie udało się odczytać garderoby z localStorage:", e);
    }
  }

  function addGarmentToWardrobe(itemText) {
    wardrobeState.push(itemText);
    saveWardrobeToStorage();
    renderWardrobeList();
  }

  // -----------------------------
  // FORMULARZ GARDEROBY (TEKST)
  // -----------------------------
  if (clothesForm) {
    clothesForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const nameInput = document.getElementById("clothing-name");
      const colorInput = document.getElementById("clothing-color");
      const typeInput = document.getElementById("clothing-type");
      const seasonInput = document.getElementById("clothing-season");

      const name = nameInput.value.trim();
      const color = colorInput.value.trim();
      const type = typeInput.value.trim();
      const season = seasonInput.value.trim();

      if (!name) {
        return;
      }

      const descriptionParts = [name];
      if (color) descriptionParts.push(`Kolor: ${color}`);
      if (type) descriptionParts.push(`Rodzaj: ${type}`);
      if (season) descriptionParts.push(`Sezon: ${season}`);

      const itemText = descriptionParts.join(" | ");

      addGarmentToWardrobe(itemText);
      clothesForm.reset();
    });
  }

  // -----------------------------
  // PREFERENCJE STYLU (NA RAZIE BEZ LOCALSTORAGE)
  // -----------------------------
  if (preferencesForm) {
    preferencesForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const preferenceInput = document.getElementById("preference-input");
      const preference = preferenceInput.value.trim();

      if (!preference) {
        return;
      }

      const li = document.createElement("li");
      li.textContent = preference;
      preferencesList.appendChild(li);

      preferenceInput.value = "";
    });
  }

  // -----------------------------
  // PODGLĄD ZDJĘĆ UBRAN
  // -----------------------------
  function previewImages(files, container) {
    container.innerHTML = "";

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "image-thumb";
        container.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }

  if (wardrobeImagesInput) {
    wardrobeImagesInput.addEventListener("change", (event) => {
      const files = event.target.files;
      previewImages(files, wardrobeImagesPreview);
    });
  }

  // -----------------------------
  // INSPIRACJE – STYL + OBRAZKI (LOCALSTORAGE)
  // -----------------------------

  const STYLE_PROFILE_KEY = "szafaAI_styleProfile";
  const STYLE_IMAGES_KEY = "szafaAI_styleImages";

  let currentStyleProfile = "";
  let styleImagesDataUrls = [];

  function renderStyleImagesFromData() {
    styleImagesPreview.innerHTML = "";
    styleImagesDataUrls.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.className = "image-thumb";
      styleImagesPreview.appendChild(img);
    });
  }

  if (styleImagesPreview && analyzeStyleResult) {
    // Przy starcie – wczytaj profil stylu
    const savedStyleProfile = localStorage.getItem(STYLE_PROFILE_KEY);
    if (savedStyleProfile) {
      currentStyleProfile = savedStyleProfile;
      analyzeStyleResult.textContent = savedStyleProfile;
    } else {
      analyzeStyleResult.textContent =
        'Brak analizy – wgraj inspiracje i kliknij „Przeanalizuj inspiracje”.';
    }

    // Przy starcie – wczytaj inspiracje (miniaturki)
    const savedStyleImagesJson = localStorage.getItem(STYLE_IMAGES_KEY);
    if (savedStyleImagesJson) {
      try {
        styleImagesDataUrls = JSON.parse(savedStyleImagesJson);
        renderStyleImagesFromData();
      } catch (e) {
        console.error("Nie udało się odczytać zapisanych inspiracji:", e);
        styleImagesDataUrls = [];
      }
    }
  }

  if (styleImagesInput) {
    // Input zdjęć inspiracji – zapis do localStorage
    styleImagesInput.addEventListener("change", (event) => {
      const files = event.target.files;

      styleImagesDataUrls = [];

      if (!files || files.length === 0) {
        styleImagesPreview.innerHTML = "";
        localStorage.removeItem(STYLE_IMAGES_KEY);
        return;
      }

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          styleImagesDataUrls.push(dataUrl);
          renderStyleImagesFromData();
          localStorage.setItem(
            STYLE_IMAGES_KEY,
            JSON.stringify(styleImagesDataUrls)
          );
        };
        reader.readAsDataURL(file);
      });
    });
  }

  if (analyzeStyleButton) {
    // Analiza inspiracji – zapis profilu stylu
    analyzeStyleButton.addEventListener("click", () => {
      const files = styleImagesInput.files;

      if (!files || files.length === 0) {
        analyzeStyleResult.textContent =
          "Najpierw wgraj przynajmniej jedno zdjęcie inspiracji.";
        return;
      }

      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      analyzeStyleResult.textContent = "Analizuję inspiracje...";

      fetch("https://szafa-ai-backend.onrender.com/api/analyze-style-images", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          const styleText =
            data.styleProfile || "Brak opisu stylu z serwera.";
          analyzeStyleResult.textContent = styleText;
          currentStyleProfile = styleText;
          localStorage.setItem(STYLE_PROFILE_KEY, styleText);
        })
        .catch((error) => {
          console.error("Błąd podczas analizy inspiracji:", error);
          analyzeStyleResult.textContent =
            "Wystąpił błąd podczas analizy inspiracji.";
        });
    });
  }

  if (clearStyleButton) {
    // Wyczyść inspiracje
    clearStyleButton.addEventListener("click", () => {
      styleImagesInput.value = "";
      styleImagesPreview.innerHTML = "";
      styleImagesDataUrls = [];
      currentStyleProfile = "";
      analyzeStyleResult.textContent =
        'Brak analizy – wgraj inspiracje i kliknij „Przeanalizuj inspiracje”.';
      localStorage.removeItem(STYLE_IMAGES_KEY);
      localStorage.removeItem(STYLE_PROFILE_KEY);
    });
  }

  // -----------------------------
  // ANALIZA ZDJĘĆ UBRANIA (VISION) – WIELE NARAZ
  // -----------------------------
  if (analyzeImageButton) {
    analyzeImageButton.addEventListener("click", async () => {
      const files = wardrobeImagesInput.files;

      if (!files || files.length === 0) {
        analyzeImageResult.textContent =
          "Najpierw wgraj przynajmniej jedno zdjęcie ubrania.";
        return;
      }

      const filesArray = Array.from(files);
      let successCount = 0;

      analyzeImageResult.textContent = `Analizuję ${filesArray.length} zdjęć...`;

      for (const file of filesArray) {
        const formData = new FormData();
        formData.append("image", file);

        try {
          const response = await fetch(
            "https://szafa-ai-backend.onrender.com/api/analyze-image",
            {
              method: "POST",
              body: formData,
            }
          );

          const data = await response.json();
          const description = data.description || "Brak opisu z serwera.";

          // dodaj opis jako element garderoby
          addGarmentToWardrobe(description);
          successCount++;

          analyzeImageResult.textContent = `Zanalizowano ${successCount} z ${filesArray.length} zdjęć...`;
        } catch (error) {
          console.error("Błąd podczas analizy zdjęcia:", error);
          // nie przerywamy, lecimy dalej z kolejnymi zdjęciami
        }
      }

      analyzeImageResult.textContent = `Gotowe! Zanalizowano ${successCount} z ${filesArray.length} zdjęć i dodano do garderoby.`;
    });
  }


  // -----------------------------
  // GENEROWANIE STYLIZACJI Z AI
  // -----------------------------
  if (generateButton) {
    generateButton.addEventListener("click", () => {
      const wardrobeItems = [...wardrobeState];

      const preferences = Array.from(
        preferencesList.querySelectorAll("li")
      ).map((li) => li.textContent);

      const tempValue = weatherTempInput.value.trim();
      const conditionValue = weatherConditionSelect.value;

      const weather = {
        temperatureC: tempValue !== "" ? Number(tempValue) : null,
        condition: conditionValue || null,
      };

      if (wardrobeItems.length === 0) {
        aiOutput.innerHTML = `
          <p>Dodaj najpierw kilka ubrań do swojej garderoby, żeby wygenerować stylizację.</p>
        `;
        aiImageArea.innerHTML = "";
        return;
      }

      aiOutput.innerHTML = `<p>Generuję stylizację...</p>`;
      aiImageArea.innerHTML = "";

      fetch("https://szafa-ai-backend.onrender.com/api/generate-outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wardrobe: wardrobeItems,
          preferences: preferences,
          styleProfile: currentStyleProfile,
          weather: weather,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          aiOutput.innerHTML = `
            <h3>Stylizacja na dziś</h3>
            <p>${data.description}</p>
          `;

          if (data.imageUrl) {
            aiImageArea.innerHTML = `
              <img src="${data.imageUrl}" alt="Stylizacja z AI" style="max-width:100%; border-radius:8px;" />
            `;
          } else {
            aiImageArea.innerHTML = `
              <p class="placeholder-text">
                Na razie generujemy tylko opis stylizacji. Obrazy z AI dodamy w kolejnym etapie.
              </p>
            `;
          }
        })
        .catch((error) => {
          console.error("Błąd podczas wywołania backendu:", error);
          aiOutput.innerHTML = `
            <p>Wystąpił błąd podczas generowania stylizacji. Spróbuj ponownie.</p>
          `;
        });
    });
  }

  // -----------------------------
  // „BRAKI W SZAFIE”
  // -----------------------------
  if (checkGapsButton && wardrobeGapsOutput) {
    checkGapsButton.addEventListener("click", () => {
      const wardrobeItems = [...wardrobeState];

      if (wardrobeItems.length === 0) {
        wardrobeGapsOutput.innerHTML = `
          <p>Dodaj ubrania, aby zobaczyć analizę braków.</p>
        `;
        return;
      }

      wardrobeGapsOutput.innerHTML = `<p>Analizuję braki w szafie...</p>`;

      fetch("https://szafa-ai-backend.onrender.com/api/wardrobe-gaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wardrobe: wardrobeItems,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          wardrobeGapsOutput.innerHTML = `
            <h3>Braki w szafie</h3>
            <p>${(data.gaps || "")
              .replace(/\n/g, "<br>")
              .replace(/  /g, "&nbsp;&nbsp;")}</p>
          `;
        })
        .catch((error) => {
          console.error("Błąd przy analizie braków:", error);
          wardrobeGapsOutput.innerHTML = `
            <p>Nie udało się przeanalizować braków. Spróbuj ponownie.</p>
          `;
        });
    });
  }
  // 🔹 Obsługa przycisku "Pokaż propozycje w Reserved"
  shopButton.addEventListener("click", () => {
    const gapsText = gapsInput.value.trim();

    if (!gapsText) {
      shopResults.innerHTML = `
        <p class="small-explainer">
          Najpierw wpisz, jakich elementów brakuje w Twojej szafie (np. "biała koszulka basic, czarne botki").
        </p>
      `;
      return;
    }

    const gaps = gapsText
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    if (gaps.length === 0) {
      shopResults.innerHTML = `
        <p class="small-explainer">
          Nie udało się odczytać braków z wpisanego tekstu. Spróbuj wpisać je po przecinku.
        </p>
      `;
      return;
    }

    const budget =
      budgetInput.value && budgetInput.value.trim() !== ""
        ? Number(budgetInput.value)
        : null;

    shopResults.innerHTML = `<p>Szukam propozycji w Reserved...</p>`;

    fetch("https://szafa-ai-backend.onrender.com/api/shop-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gaps,
        budgetPerItem: budget,
        currency: "PLN",
        country: "PL",
        preferredStore: "Reserved",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.suggestions || data.suggestions.length === 0) {
          shopResults.innerHTML = `
            <p class="small-explainer">
              Na razie brak propozycji. Spróbuj wpisać inne braki.
            </p>
          `;
          return;
        }

        // Budujemy kafelki z propozycjami
        shopResults.innerHTML = data.suggestions
          .map((sugg) => {
            return `
              <div class="shop-card">
                <h4>${sugg.gap}</h4>
                <p>Sklep: <strong>${sugg.store}</strong></p>
                ${
                  sugg.approxPrice
                    ? `<p>Budżet na 1 sztukę: ok. ${sugg.approxPrice} ${sugg.currency}</p>`
                    : ""
                }
                <p>
                  <a href="${sugg.searchUrl}" target="_blank" rel="noopener noreferrer">
                    Otwórz wyszukiwanie w Reserved
                  </a>
                </p>
                <p class="small-explainer">${sugg.note}</p>
              </div>
            `;
          })
          .join("");
      })
      .catch((error) => {
        console.error("Błąd podczas pobierania propozycji z Reserved:", error);
        shopResults.innerHTML = `
          <p class="small-explainer">
            Wystąpił błąd podczas pobierania propozycji. Spróbuj ponownie za chwilę.
          </p>
        `;
      });
  });

  // -----------------------------
  // START
  // -----------------------------
  loadWardrobeFromStorage();
  // domyślnie pokaż ekran garderoby (jeśli nawigacja jest)
  if (navButtons.length > 0) {
    showScreen("wardrobe");
  }
});
