# Crystal Beauty – termini i SMS podsjetnici

Web aplikacija za salon umjesto sveske. Termini se unose sa telefona, a klijent automatski dobija SMS **24 sata prije termina**. Ako je termin zakazan manje od 24 sata unaprijed, SMS odlazi odmah po čuvanju.

Primjer poruke (bez kvačica, da stane u jedan SMS):

> Ana, podsjecamo vas na termin sutra u 14:00 (manikir) u salonu Crystal Beauty. Vidimo se!

## Kako radi

- **Dva kalendara, Sanja i Nina.** Svaka se prijavljuje svojom lozinkom. Sanja vidi i Ninin kalendar, ali ga ne može mijenjati. Nina vidi samo svoj. Admin prijava (`ADMIN_PASSWORD`) služi za održavanje i može mijenjati oba.
- **Unos termina:** ime, telefon (npr. `065 123 456`), usluga iz liste (ili „Ostalo“ sa upisanim nazivom i trajanjem), datum, vrijeme, napomena i saglasnost za SMS.
- **Usluge i trajanja** su u `src/lib/catalog.ts`. Tu se mijenja trajanje, dodaje nova usluga ili mijenja ko je radi.
- **Vrijeme** se bira od 08:00 do 20:00 (posljednji početak), na svakih 15 minuta. Zauzeto je sve što bi se preklopilo sa drugim terminom iste osobe, uzimajući u obzir trajanje usluge.
- **Soba za pedikir i masažu je zajednička.** Pedikir, masaže i depilacija ne mogu se zakazati dok druga osoba ima termin u toj sobi. Nokti se rade u glavnoj prostoriji, gdje mogu raditi obje istovremeno.
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
   | `ADMIN_PASSWORD` | lozinka za održavanje (oba kalendara) |
   | `PASSWORD_SANJA` | Sanjina lozinka |
   | `PASSWORD_NINA` | Ninina lozinka |
   | `SESSION_SECRET` | nasumičan tekst, najmanje 16 znakova |
   | `SMS_SENDER` | ime pošiljaoca, najviše 11 znakova (podrazumijevano `Crystal`) |
   | `IPHONE_TOKEN` | tajni ključ za slanje SMS-a sa iPhone-a (vidi dolje) |
   | `INFOBIP_BASE_URL`, `INFOBIP_API_KEY` | podaci sa Infobip naloga (ima prednost nad iPhone-om) |

3. Ponovo pokrenite deploy.

Dok Infobip nije povezan, aplikacija radi u **test načinu**: sve funkcioniše, ali se SMS samo upisuje u log funkcije i ne šalje se stvarno. U aplikaciji se tada vidi žuta traka.

## Na iPhone-u

Otvorite adresu sajta u Safariju, zatim **Dijeli → Dodaj na početni ekran**. Aplikacija se otvara kao obična aplikacija, sa ikonicom „Termini“.

## Slanje SMS-a sa iPhone-a (Prečice)

Kada je postavljen `IPHONE_TOKEN` (a Infobip nije), server ne šalje SMS sam. Automatizacija u aplikaciji Prečice na iPhone-u salona svaki sat:

1. otvori `https://<sajt>/api/iphone/poruke?kljuc=<IPHONE_TOKEN>`, koji vraća listu `[{ broj, tekst, potvrda }]` za podsjetnike koji su na redu,
2. za svaku stavku pošalje poruku `tekst` na `broj`,
3. otvori `potvrda` URL, čime se termin označava kao „SMS poslat“.

Poruke se predaju samo između 08:00 i 21:00. Stavka koja nije potvrđena predaje se ponovo nakon 10 minuta, najviše 3 puta, a zatim termin dobija oznaku greške.

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
