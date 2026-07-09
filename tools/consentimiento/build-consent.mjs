// Generador del PDF "Consentimiento informado para publicar un testimonio" (ES / EN / DA).
// Marca Studio Renacer (crema/marrón/oro + Cormorant/Spectral/Jost). HTML -> PDF con Chrome.
// Reutiliza las fuentes de tools/guias/fonts. Editar textos aquí y volver a ejecutar:
//   node tools/consentimiento/build-consent.mjs   (luego renderizar con Chrome; ver README)
// Salida: tools/consentimiento/out/*.html  ->  docs/consentimiento-testimonio-<LANG>.pdf

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const RESP = 'Andrea Fernández García · NIF 23816407E · Av. Caldes de Montbui, 19, 08100 Mollet del Vallès (Barcelona), España · admin@studiorenacer.com';

const DATA = {
  es: {
    file: 'consentimiento-testimonio-ES',
    eyebrow: 'Consentimiento · RGPD',
    title: 'Consentimiento informado para publicar un testimonio',
    respLabel: 'Responsable del tratamiento',
    resp: RESP,
    s1t: '1. Qué autorizas',
    s1p: 'Autorizo a Studio Renacer (Andrea Fernández García) a publicar la opinión / testimonio que he facilitado sobre mi experiencia, en su página web (studiorenacer.com) y, en su caso, en sus materiales de comunicación y redes sociales, con la finalidad de dar a conocer el servicio.',
    s1label: 'Texto del testimonio (o se adjunta por separado):',
    s2t: '2. Cómo quiero aparecer',
    s2hint: '(marca una opción)',
    opts: ['Con mi nombre de pila + inicial — p. ej. «María G.»', 'Solo con mis iniciales — p. ej. «M. G.»', 'De forma anónima — «Paciente verificada»'],
    s3t: '3. Información importante',
    s3: [
      'Mi participación es totalmente voluntaria. Negarme, o retirar más adelante mi consentimiento, no afecta en modo alguno a mi atención, mi tratamiento ni mi relación profesional con la psicóloga.',
      'El testimonio refleja mi experiencia personal; no constituye una promesa de resultados ni una valoración clínica.',
      'No se publicará ningún diagnóstico, dato de salud ni detalle que permita identificarme más allá de lo que autorizo en el punto 2.',
      'Mi testimonio no se publicará hasta que Andrea lo revise.'
    ],
    s4t: '4. Base jurídica y tus derechos (RGPD)',
    s4: [
      'Base jurídica: mi consentimiento explícito (art. 6.1.a y, por tratarse en su caso de datos de salud, art. 9.2.a del RGPD (UE) 2016/679).',
      'Puedo revocar este consentimiento y solicitar la retirada del testimonio en cualquier momento, sin necesidad de justificarlo, escribiendo a admin@studiorenacer.com o info@studiorenacer.com. La revocación no afecta a la licitud del tratamiento realizado antes de la misma.',
      'Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad (política de privacidad: studiorenacer.com/privacy).',
      'Conservación: el testimonio permanecerá publicado hasta que revoque mi consentimiento o solicite su retirada.'
    ],
    s5t: '5. Firma',
    fName: 'Nombre y apellidos', fId: 'DNI / NIE (opcional)', fDate: 'Fecha',
    fSignPerson: 'Firma de la persona',
    proBy: 'Por Studio Renacer — Andrea Fernández García · Psicóloga colegiada n.º 27327',
    fSignPro: 'Firma'
  },
  en: {
    file: 'consentimiento-testimonio-EN',
    eyebrow: 'Consent · GDPR',
    title: 'Informed consent to publish a testimonial',
    respLabel: 'Data controller',
    resp: 'Andrea Fernández García · Tax ID (NIF) 23816407E · Av. Caldes de Montbui, 19, 08100 Mollet del Vallès (Barcelona), Spain · admin@studiorenacer.com',
    s1t: '1. What you authorise',
    s1p: 'I authorise Studio Renacer (Andrea Fernández García) to publish the opinion / testimonial I have provided about my experience, on its website (studiorenacer.com) and, where applicable, in its communication materials and social media, for the purpose of promoting the service.',
    s1label: 'Testimonial text (or attached separately):',
    s2t: '2. How I want to appear',
    s2hint: '(tick one option)',
    opts: ['With my first name + initial — e.g. "María G."', 'With my initials only — e.g. "M. G."', 'Anonymously — "Verified client"'],
    s3t: '3. Important information',
    s3: [
      'My participation is entirely voluntary. Refusing, or later withdrawing my consent, does not in any way affect my care, my treatment or my professional relationship with the psychologist.',
      'The testimonial reflects my personal experience; it is not a promise of results or a clinical assessment.',
      'No diagnosis, health data or detail that could identify me beyond what I authorise in point 2 will be published.',
      'My testimonial will not be published until Andrea reviews it.'
    ],
    s4t: '4. Legal basis and your rights (GDPR)',
    s4: [
      'Legal basis: my explicit consent (art. 6.1.a and, where health data is involved, art. 9.2.a of the GDPR (EU) 2016/679).',
      'I may withdraw this consent and request the removal of the testimonial at any time, without justification, by writing to admin@studiorenacer.com or info@studiorenacer.com. Withdrawal does not affect the lawfulness of processing carried out beforehand.',
      'I may exercise my rights of access, rectification, erasure, objection, restriction and portability (privacy policy: studiorenacer.com/privacy).',
      'Retention: the testimonial will remain published until I withdraw my consent or request its removal.'
    ],
    s5t: '5. Signature',
    fName: 'Full name', fId: 'ID no. (optional)', fDate: 'Date',
    fSignPerson: 'Signature of the person',
    proBy: 'For Studio Renacer — Andrea Fernández García · Licensed psychologist reg. no. 27327',
    fSignPro: 'Signature'
  },
  da: {
    file: 'consentimiento-testimonio-DA',
    eyebrow: 'Samtykke · GDPR',
    title: 'Informeret samtykke til at udgive en udtalelse',
    respLabel: 'Dataansvarlig',
    resp: 'Andrea Fernández García · Skattenr. (NIF) 23816407E · Av. Caldes de Montbui, 19, 08100 Mollet del Vallès (Barcelona), Spanien · admin@studiorenacer.com',
    s1t: '1. Hvad du giver tilladelse til',
    s1p: 'Jeg giver Studio Renacer (Andrea Fernández García) tilladelse til at udgive den udtalelse, jeg har givet om min oplevelse, på hjemmesiden (studiorenacer.com) og eventuelt i kommunikationsmaterialer og på sociale medier med det formål at gøre opmærksom på ydelsen.',
    s1label: 'Udtalelsens tekst (eller vedlægges separat):',
    s2t: '2. Hvordan jeg vil vises',
    s2hint: '(sæt ét kryds)',
    opts: ['Med mit fornavn + initial — f.eks. »María G.«', 'Kun med mine initialer — f.eks. »M. G.«', 'Anonymt — »Verificeret klient«'],
    s3t: '3. Vigtig information',
    s3: [
      'Min deltagelse er helt frivillig. At sige nej, eller senere trække mit samtykke tilbage, påvirker på ingen måde min behandling eller mit professionelle forhold til psykologen.',
      'Udtalelsen afspejler min personlige oplevelse; den er ikke et løfte om resultater eller en klinisk vurdering.',
      'Ingen diagnose, helbredsoplysning eller detalje, der kan identificere mig ud over det, jeg giver tilladelse til i punkt 2, vil blive udgivet.',
      'Min udtalelse udgives først, når Andrea har gennemgået den.'
    ],
    s4t: '4. Retsgrundlag og dine rettigheder (GDPR)',
    s4: [
      'Retsgrundlag: mit udtrykkelige samtykke (art. 6.1.a og, hvor der indgår helbredsoplysninger, art. 9.2.a i GDPR (EU) 2016/679).',
      'Jeg kan trække dette samtykke tilbage og bede om at få udtalelsen fjernet når som helst, uden begrundelse, ved at skrive til admin@studiorenacer.com eller info@studiorenacer.com. Tilbagetrækning påvirker ikke lovligheden af den behandling, der er sket forinden.',
      'Jeg kan udøve mine rettigheder til indsigt, berigtigelse, sletning, indsigelse, begrænsning og dataportabilitet (privatlivspolitik: studiorenacer.com/privacy).',
      'Opbevaring: udtalelsen forbliver offentliggjort, indtil jeg trækker mit samtykke tilbage eller beder om at få den fjernet.'
    ],
    s5t: '5. Underskrift',
    fName: 'Fulde navn', fId: 'CPR-nr. (valgfrit)', fDate: 'Dato',
    fSignPerson: 'Personens underskrift',
    proBy: 'For Studio Renacer — Andrea Fernández García · Autoriseret psykolog reg.nr. 27327',
    fSignPro: 'Underskrift'
  }
};

const CSS = `
  @page { size:210mm 297mm; margin:0; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @font-face{font-family:'Cormorant Garamond';src:url('../../guias/fonts/CormorantGaramond.ttf') format('truetype');font-weight:300 700;font-style:normal;}
  @font-face{font-family:'Spectral';src:url('../../guias/fonts/Spectral-Regular.ttf') format('truetype');font-weight:400;font-style:normal;}
  @font-face{font-family:'Spectral';src:url('../../guias/fonts/Spectral-Medium.ttf') format('truetype');font-weight:500;font-style:normal;}
  @font-face{font-family:'Spectral';src:url('../../guias/fonts/Spectral-Italic.ttf') format('truetype');font-weight:400;font-style:italic;}
  @font-face{font-family:'Jost';src:url('../../guias/fonts/Jost.ttf') format('truetype');font-weight:300 700;font-style:normal;}
  :root{ --paper:#F8F1E3; --ink:#5B4128; --body:#4b4235; --muted:#7A6A53; --oro:#E3A52A; --ocre:#B07A2B; --line:rgba(91,65,40,.22); --card:#FFFFFF; }
  html,body{ background:#fff; }
  body{ font-family:'Spectral',Georgia,serif; color:var(--body); font-size:9pt; line-height:1.38; }
  .page{ position:relative; width:210mm; min-height:297mm; padding:13mm 17mm 10mm; background:var(--paper); }
  .brandtop{ font-family:'Jost',sans-serif; font-size:8.5pt; font-weight:600; letter-spacing:.34em; color:var(--ocre); }
  .eyebrow{ font-family:'Jost',sans-serif; font-size:7pt; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:var(--ocre); margin:9pt 0 3pt; }
  h1{ font-family:'Cormorant Garamond',serif; font-weight:600; font-size:20pt; line-height:1.08; color:var(--ink); margin-bottom:6pt; }
  .rule{ height:2px; background:var(--oro); width:42px; margin:2pt 0 9pt; }
  .resp{ background:var(--card); border:1px solid var(--line); border-radius:8px; padding:6pt 11pt; margin-bottom:9pt; font-size:8.4pt; }
  .resp .l{ font-family:'Jost',sans-serif; font-size:6.5pt; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--ocre); display:block; margin-bottom:2pt; }
  h2{ font-family:'Jost',sans-serif; font-weight:600; font-size:9pt; letter-spacing:.02em; color:var(--ink); margin:8pt 0 4pt; }
  h2 .hint{ font-family:'Spectral',serif; font-weight:400; font-style:italic; font-size:8pt; color:var(--muted); letter-spacing:0; }
  p{ margin-bottom:4pt; }
  .fieldlabel{ font-size:8.2pt; color:var(--muted); margin:5pt 0 3pt; }
  .writeline{ border-bottom:1px solid var(--line); height:11pt; margin-bottom:4pt; }
  ul{ list-style:none; }
  li{ position:relative; padding-left:13pt; margin-bottom:3pt; }
  li::before{ content:'—'; position:absolute; left:0; color:var(--oro); }
  .opts li{ padding-left:19pt; margin-bottom:5pt; }
  .box{ position:absolute; left:0; top:0.5pt; width:11pt; height:11pt; border:1.5px solid var(--ocre); border-radius:2px; background:#fff; }
  .opts li::before{ content:''; }
  .sign{ margin-top:8pt; border-top:1px solid var(--line); padding-top:8pt; }
  .sigrow{ display:flex; gap:16pt; margin-bottom:2pt; }
  .sigcol{ flex:1; }
  .siglabel{ font-family:'Jost',sans-serif; font-size:6.5pt; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--ocre); margin-top:3pt; }
  .sigfill{ border-bottom:1px solid var(--line); height:17pt; }
  .pro{ margin-top:9pt; font-size:8.4pt; color:var(--ink); }
  .foot{ margin-top:10pt; font-family:'Jost',sans-serif; font-size:7pt; color:var(--muted); letter-spacing:.04em; text-align:center; }
`;

function render(d) {
  return `<!doctype html><html lang="${d.file.slice(-2).toLowerCase()}"><head><meta charset="utf-8"><title>${d.file}</title><style>${CSS}</style></head><body>
  <div class="page">
    <div class="brandtop">STUDIO RENACER</div>
    <div class="eyebrow">${d.eyebrow}</div>
    <h1>${d.title}</h1>
    <div class="rule"></div>
    <div class="resp"><span class="l">${d.respLabel}</span>${d.resp}</div>

    <h2>${d.s1t}</h2>
    <p>${d.s1p}</p>
    <div class="fieldlabel">${d.s1label}</div>
    <div class="writeline"></div><div class="writeline"></div>

    <h2>${d.s2t} <span class="hint">${d.s2hint}</span></h2>
    <ul class="opts">
      ${d.opts.map(o => `<li><span class="box"></span>${o}</li>`).join('')}
    </ul>

    <h2>${d.s3t}</h2>
    <ul>${d.s3.map(x => `<li>${x}</li>`).join('')}</ul>

    <h2>${d.s4t}</h2>
    <ul>${d.s4.map(x => `<li>${x}</li>`).join('')}</ul>

    <div class="sign">
      <h2>${d.s5t}</h2>
      <div class="sigrow">
        <div class="sigcol"><div class="sigfill"></div><div class="siglabel">${d.fName}</div></div>
        <div class="sigcol" style="flex:.6"><div class="sigfill"></div><div class="siglabel">${d.fId}</div></div>
        <div class="sigcol" style="flex:.5"><div class="sigfill"></div><div class="siglabel">${d.fDate}</div></div>
      </div>
      <div class="sigrow" style="margin-top:8pt">
        <div class="sigcol"><div class="sigfill"></div><div class="siglabel">${d.fSignPerson}</div></div>
      </div>
      <p class="pro">${d.proBy}</p>
      <div class="sigrow" style="margin-top:4pt">
        <div class="sigcol" style="flex:.5"><div class="sigfill"></div><div class="siglabel">${d.fDate}</div></div>
        <div class="sigcol"><div class="sigfill"></div><div class="siglabel">${d.fSignPro}</div></div>
      </div>
    </div>

    <div class="foot">Studio Renacer · studiorenacer.com</div>
  </div>
  </body></html>`;
}

for (const k of Object.keys(DATA)) {
  const d = DATA[k];
  writeFileSync(join(OUT, `${d.file}.html`), render(d), 'utf8');
  console.log('escrito', d.file + '.html');
}
console.log('OK');
