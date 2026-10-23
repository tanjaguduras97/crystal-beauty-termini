# Crystal Beauty – termini i SMS podsjetnici

Web aplikacija za salon umjesto sveske. Termini se unose sa telefona, a klijent automatski dobija SMS **24 sata prije termina**. Ako je termin zakazan manje od 24 sata unaprijed, SMS odlazi odmah po čuvanju.

Primjer poruke (bez kvačica, da stane u jedan SMS):

> Postovani/a Ana, podsjecamo vas na termin sutra u 14:00 (manikir) u salonu Crystal Beauty. Vidimo se!

## Kako radi

- **Unos termina:** ime, telefon (npr. `065 123 456`), usluga, datum, vrijeme, napomena i saglasnost za SMS.
- **Pregled po danima,** kao u svesci, sa oznakom stanja podsjetnika za svaki termin: kada ide, poslat, greška.
- **Otkazan ili obrisan termin** ne dobija podsjetnik. Ako se termin pomjeri na drugo vrijeme ili broj, podsjetnik se ponovo šalje.
- **Netlify zakazana funkcija** (`netlify/functions/send-reminders.mts`) svakih 5 minuta šalje podsjetnike koji su na redu. Neuspjelo slanje pokušava još 2 puta, a nakon toga termin dobija crvenu oznaku „nazovite klijenta“.
- **Vrijeme** se uvijek računa po zoni Europe/Sarajevo, uključujući ljetno i zimsko računanje vremena.
- **Podaci** se čuvaju u Netlify Blobs. Nije potrebna posebna baza.

## Postavljanje na Netlify

1. Na Netlify-ju napravite novi sajt iz ovog repozitorija. Build postavke su već u `netlify.toml`.
2. U **Site configuration → Environment variables** dodajte varijable (pogledajte `.env.example`):

   | Varijabla | Opis |
   |---|---|
   | `ADMIN_PASSWORD` | lozinka za ulaz u aplikaciju |
   | `SESSION_SECRET` | nasumičan tekst, najmanje 16 znakova |
   | `SMS_SENDER` | ime pošiljaoca, najviše 11 znakova (podrazumijevano `Crystal`) |
   | `INFOBIP_BASE_URL`, `INFOBIP_API_KEY` | podaci sa Infobip naloga |

3. Ponovo pokrenite deploy.

Dok Infobip nije povezan, aplikacija radi u **test načinu**: sve funkcioniše, ali se SMS samo upisuje u log funkcije i ne šalje se stvarno. U aplikaciji se tada vidi žuta traka.

## Na iPhone-u

Otvorite adresu sajta u Safariju, zatim **Dijeli → Dodaj na početni ekran**. Aplikacija se otvara kao obična aplikacija, sa ikonicom „Termini“.

## SMS provajder (Infobip)

1. Otvorite nalog na infobip.com. Za BiH je obično potrebna registrovana djelatnost.
2. Registrujte ime pošiljaoca `Crystal` (alfanumerički sender ID za BiH).
3. Kopirajte **API Base URL** i **API key** u varijable iznad.

Slanje je u jednom fajlu (`src/server/sms.ts`), pa se provajder može zamijeniti (npr. m:tel poslovni SMS) bez diranja ostatka aplikacije.

## Razvoj

```bash
npm install
cp .env.example .env   # popunite ADMIN_PASSWORD i SESSION_SECRET
npm run dev            # http://localhost:3000
npm test               # testovi logike podsjetnika
npm run typecheck
```
