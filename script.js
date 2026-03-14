/*
  Ten plik dodaje interaktywność do naszej strony.

  Co robimy:
    - zapisujemy preferencje stylu,
    - obsługujemy wgrywanie zdjęć (ubrania + inspiracje) i pokazujemy miniaturki,
    - zapisujemy inspiracje w localStorage,
    - po kliknięciu przycisku wysyłamy dane do backendu,
    - backend woła AI i zwraca opis stylizacji,
    - dodatkowo: analiza braków w szafie.
*/

const API_BASE = "https://szafa-ai-backend.onrender.com";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAifWtEi0gXqGlAZ72WtDPzh26_pW7xDxE",
  authDomain: "check-list-df7cf.firebaseapp.com",
  projectId: "check-list-df7cf",
  storageBucket: "check-list-df7cf.firebasestorage.app",
  messagingSenderId: "616867588591",
  appId: "1:616867588591:web:2c514803d3393393516e1a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

window.loginGoogle = async () => {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");

    const result = await signInWithPopup(auth, provider);
    const token = await result.user.getIdToken(true);

    localStorage.setItem("authToken", token);
    localStorage.setItem("userEmail", result.user.email || "");

    alert("Zalogowano: " + result.user.email);

    const items = await window.loadGarments();
    window.renderGarments(items);
  } catch (e) {
    console.error("Błąd logowania:", e);
    alert("Błąd logowania - zobacz Console");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const wardrobeList = document.getElementById("wardrobe-list");

  const preferencesForm = document.getElementById("preferences-form");
  const preferencesList = document.getElementById("preferences-list");

  const generateButton = document.getElementById("generate-outfits-button");
  const aiOutput = document.getElementById("ai-output");
  const aiImageArea = document.getElementById("ai-image-area");

  const gapsInput = document.getElementById("gaps-input");
  const budgetInput = document.getElementById("budget-input");
  const shopButton = document.getElementById("shop-suggestions-button");
  const shopResults = document.getElementById("shop-suggestions-results");

  const weatherTempInput = document.getElementById("weather-temp");
  const weatherConditionSelect = document.getElementById("weather-condition");

  const wardrobeImagesInput = document.getElementById("wardrobe-images-input");
  const wardrobeImagesPreview = document.getElementById(
    "wardrobe-images-preview"
  );

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

  const checkGapsButton = document.getElementById("check-gaps-button");
  const wardrobeGapsOutput = document.getElementById("wardrobe-gaps-output");

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

  if (navButtons.length > 0) {
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.screen;
        showScreen(target);
      });
    });
  }

  const STYLE_PROFILE_KEY = "szafaAI_styleProfile";
  const STYLE_IMAGES_KEY = "szafaAI_styleImages";

  let wardrobeState = [];
  let currentStyleProfile = "";
  let styleImagesDataUrls = [];

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

  function renderStyleImagesFromData() {
    styleImagesPreview.innerHTML = "";

    styleImagesDataUrls.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.className = "image-thumb";
      styleImagesPreview.appendChild(img);
    });
  }

  if (wardrobeImagesInput) {
    wardrobeImagesInput.addEventListener("change", (event) => {
      const files = event.target.files;
      previewImages(files, wardrobeImagesPreview);
    });
  }

  if (styleImagesPreview && analyzeStyleResult) {
    const savedStyleProfile = localStorage.getItem(STYLE_PROFILE_KEY);
    if (savedStyleProfile) {
      currentStyleProfile = savedStyleProfile;
      analyzeStyleResult.textContent = savedStyleProfile;
    } else {
      analyzeStyleResult.textContent =
        'Brak analizy – wgraj inspiracje i kliknij „Przeanalizuj inspiracje”.';
    }

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

      fetch(`${API_BASE}/api/analyze-style-images`, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          const styleText = data.styleProfile || "Brak opisu stylu z serwera.";
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

  if (analyzeImageButton) {
    analyzeImageButton.addEventListener("click", async () => {
      const files = wardrobeImagesInput.files;

      if (!files || files.length === 0) {
        analyzeImageResult.textContent =
          "Najpierw wgraj przynajmniej jedno zdjęcie ubrania.";
        return;
      }

      const token = localStorage.getItem("authToken");
      if (!token) {
        analyzeImageResult.textContent = "Najpierw zaloguj się przez Google.";
        return;
      }

      const filesArray = Array.from(files);
      let successCount = 0;

      analyzeImageResult.textContent = `Analizuję ${filesArray.length} zdjęć...`;

      for (const file of filesArray) {
        const formData = new FormData();
        formData.append("image", file);

        try {
          const response = await fetch(`${API_BASE}/api/analyze-image`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          const description = data.description || "Brak opisu z serwera.";

          const saveRes = await fetch(`${API_BASE}/api/garments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({
              name: description,
            }),
          });

          if (!saveRes.ok) {
            throw new Error("Nie udało się zapisać ubrania do bazy.");
          }

          successCount++;
          analyzeImageResult.textContent = `Zanalizowano ${successCount} z ${filesArray.length} zdjęć...`;
        } catch (error) {
          console.error("Błąd podczas analizy / zapisu zdjęcia:", error);
        }
      }

      await window.refreshWardrobe();
      analyzeImageResult.textContent = `Gotowe! Zanalizowano ${successCount} z ${filesArray.length} zdjęć i zapisano do garderoby.`;
    });
  }

  if (preferencesForm) {
    preferencesForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const preferenceInput = document.getElementById("preference-input");
      const preference = preferenceInput.value.trim();

      if (!preference) return;

      const li = document.createElement("li");
      li.textContent = preference;
      preferencesList.appendChild(li);

      preferenceInput.value = "";
    });
  }

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
        aiOutput.innerHTML =
          "<p>Dodaj najpierw kilka ubrań do swojej garderoby, żeby wygenerować stylizację.</p>";
        aiImageArea.innerHTML = "";
        return;
      }

      aiOutput.innerHTML = "<p>Generuję stylizację...</p>";
      aiImageArea.innerHTML = "";

      fetch(`${API_BASE}/api/generate-outfit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wardrobe: wardrobeItems,
          preferences,
          styleProfile: currentStyleProfile,
          weather,
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
          aiOutput.innerHTML =
            "<p>Wystąpił błąd podczas generowania stylizacji. Spróbuj ponownie.</p>";
        });
    });
  }

  if (checkGapsButton && wardrobeGapsOutput) {
    checkGapsButton.addEventListener("click", () => {
      const wardrobeItems = [...wardrobeState];

      if (wardrobeItems.length === 0) {
        wardrobeGapsOutput.innerHTML =
          "<p>Dodaj ubrania, aby zobaczyć analizę braków.</p>";
        return;
      }

      wardrobeGapsOutput.innerHTML = "<p>Analizuję braki w szafie...</p>";

      fetch(`${API_BASE}/api/wardrobe-gaps`, {
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
          wardrobeGapsOutput.innerHTML =
            "<p>Nie udało się przeanalizować braków. Spróbuj ponownie.</p>";
        });
    });
  }

  if (shopButton) {
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

      shopResults.innerHTML = "<p>Szukam propozycji w Reserved...</p>";

      fetch(`${API_BASE}/api/shop-suggestions`, {
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
  }

  window.checkMe = async () => {
    const token = localStorage.getItem("authToken");
    alert("Token jest? " + (token ? "TAK" : "NIE"));

    const res = await fetch(`${API_BASE}/api/me`, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const text = await res.text();
    alert(text);
  };

  window.loadGarments = async function () {
    const token = localStorage.getItem("authToken");
    if (!token) return [];

    const res = await fetch(`${API_BASE}/api/garments`, {
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    console.log("GARMENTS:", data);

    return data;
  };

  window.renderGarments = function (items) {
    const list = document.getElementById("wardrobe-list");
    if (!list) return;

    list.innerHTML = "";
    wardrobeState = [];

    items.forEach((g) => {
      const label = `${g.name}${g.color ? " • " + g.color : ""}${
        g.category ? " • " + g.category : ""
      }${g.season ? " • " + g.season : ""}`;

      wardrobeState.push(label);

      const li = document.createElement("li");
      li.textContent = label;
      list.appendChild(li);
    });
  };

  window.logout = async function () {
    try {
      await signOut(auth);
      localStorage.removeItem("authToken");
      localStorage.removeItem("userEmail");
      wardrobeState = [];
      window.renderGarments([]);
      alert("Wylogowano.");
      location.reload();
    } catch (e) {
      console.error("Błąd wylogowania:", e);
      alert("Nie udało się wylogować.");
    }
  };

  window.refreshWardrobe = async function () {
    const items = await window.loadGarments();
    window.renderGarments(items);
  };

  const token = localStorage.getItem("authToken");
  if (token) {
    window.refreshWardrobe();
  } else {
    window.renderGarments([]);
  }
});