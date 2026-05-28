# Plan Sali - Rozmieszczenie Gości

Interaktywna aplikacja do planowania rozmieszczenia gości weselnych.

- Kliknij miejsce → przypisz/edytuj/usuń gościa
- Wyszukiwarka podświetla przypisane miejsca
- Synchronizacja w czasie rzeczywistym przez Firebase (opcjonalnie)

---

## Szybki start (lokalne uruchomienie)

```bash
npm install
npm run dev
```

Otwórz `http://localhost:5173` — aplikacja działa lokalnie (dane w pamięci przeglądarki).

---

## Włączenie synchronizacji na żywo (Firebase)

Dzięki Firebase **każda osoba mająca link widzi zmiany innych w czasie rzeczywistym**.

### 1. Utwórz projekt Firebase

1. Wejdź na [console.firebase.google.com](https://console.firebase.google.com)
2. Kliknij **Dodaj projekt**, podaj nazwę, kliknij dalej
3. W panelu projektu kliknij **Realtime Database** → **Utwórz bazę danych**
4. Wybierz lokalizację (np. `europe-west1`), tryb **testowy** (publiczny odczyt/zapis)

### 2. Skopiuj konfigurację

W Firebase Console:
**Ustawienia projektu** (ikona koła zębatego) → **Ogólne** → przewiń do sekcji **Twoje aplikacje** → **Dodaj aplikację** (ikona `</>`) → skopiuj obiekt `firebaseConfig`.

### 3. Wklej do pliku konfiguracyjnego

Otwórz `src/firebase-config.ts` i zastąp wartości `WKLEJ_...` swoimi danymi:

```typescript
export const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "moje-wesele.firebaseapp.com",
  databaseURL:       "https://moje-wesele-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "moje-wesele",
  storageBucket:     "moje-wesele.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc...",
};
```

Po zapisaniu i przeładowaniu strony powinna pojawić się zielona etykieta **Synchronizacja na żywo**.

### Reguły bezpieczeństwa Firebase

W Firebase Console → Realtime Database → **Reguły** ustaw:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Oznacza to, że każda osoba ze stałym linkiem może edytować dane (odpowiednie dla grupy zaufanych osób).

---

## Wdrożenie na GitHub Pages

### Automatycznie (po każdym `git push`)

1. Wypchnij repozytorium na GitHub
2. Wejdź w **Settings → Pages → Source** i wybierz **GitHub Actions**
3. Przy następnym `git push` do gałęzi `main` Actions automatycznie zbuduje i opublikuje stronę

Link do strony: `https://<twoj-nick>.github.io/<nazwa-repo>/`

### Ręcznie (jednorazowo)

```bash
npm run build
# Wgraj zawartość folderu dist/ na GitHub Pages lub inny hosting
```

---

## Struktura stołów

| Stół          | Miejsc |
|---------------|--------|
| Stół Honorowy | 2      |
| Stół Lewy     | 42     |
| Stół 1        | 24     |
| Stół 2        | 24     |
| Stół 3        | 24     |
| Stół Prawy    | 36     |
| **Razem**     | **152**|
