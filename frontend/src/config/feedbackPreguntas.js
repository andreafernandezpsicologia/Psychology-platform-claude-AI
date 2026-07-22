// Catálogo de preguntas de feedback clínico. Debe mantenerse en sync con el
// gemelo del backend (backend/config/feedbackPreguntas.js), que valida por id.
//
//   escala:     deslizador 0-10 (0 = muy mal, 10 = muy bien)
//   frecuencia: opciones categóricas (0..n-1); más = peor, se pinta aparte
//
// Preguntas definidas con Andrea (jul-2026): ORS enfocado a estado y trabajo,
// sin preguntar por relaciones (no siempre es lo que se trabaja).
export const PREGUNTAS_FEEDBACK = {
  ors: [
    {
      id: 'animo', tipo: 'escala',
      label: {
        es: '¿Cómo te has sentido esta semana?',
        en: 'How have you felt this week?',
        da: 'Hvordan har du haft det i denne uge?',
      },
    },
    {
      id: 'trabajo', tipo: 'escala',
      label: {
        es: '¿Cómo te sientes respecto a lo que estamos trabajando?',
        en: 'How do you feel about what we are working on?',
        da: 'Hvordan føler du dig om det, vi arbejder med?',
      },
    },
    {
      id: 'ansiedad', tipo: 'frecuencia',
      label: {
        es: '¿Cuántas veces has sentido ansiedad o emociones difíciles de controlar?',
        en: 'How often have you felt anxiety or emotions hard to control?',
        da: 'Hvor ofte har du følt angst eller svære følelser at styre?',
      },
      opciones: {
        es: ['Nunca', 'Algún día', 'Varios días', 'Casi cada día', 'Cada día'],
        en: ['Never', 'Some days', 'Several days', 'Almost every day', 'Every day'],
        da: ['Aldrig', 'Enkelte dage', 'Flere dage', 'Næsten hver dag', 'Hver dag'],
      },
    },
  ],
  srs: [
    {
      id: 'escucha', tipo: 'escala',
      label: {
        es: 'Me sentí escuchada/o y entendida/o',
        en: 'I felt heard and understood',
        da: 'Jeg følte mig hørt og forstået',
      },
    },
    {
      id: 'objetivos', tipo: 'escala',
      label: {
        es: 'Trabajamos en lo que a mí me importa',
        en: 'We worked on what matters to me',
        da: 'Vi arbejdede med det, der betyder noget for mig',
      },
    },
    {
      id: 'enfoque', tipo: 'escala',
      label: {
        es: 'El enfoque de hoy me ha encajado',
        en: "Today's approach suited me",
        da: 'Dagens tilgang passede mig',
      },
    },
    {
      id: 'global', tipo: 'escala',
      label: {
        es: 'En general, cómo ha ido la sesión',
        en: 'Overall, how the session went',
        da: 'Samlet set, hvordan sessionen gik',
      },
    },
  ],
};

const TITULOS = {
  ors: {
    es: '¿Cómo estás esta semana?', en: 'How are you this week?', da: 'Hvordan har du det i denne uge?',
  },
  srs: {
    es: '¿Cómo ha ido la sesión?', en: 'How did the session go?', da: 'Hvordan gik sessionen?',
  },
};

const txt = (obj, lang) => obj[lang] || obj.es;

export function preguntasDe(tipo) { return PREGUNTAS_FEEDBACK[tipo] || []; }
export function tituloDe(tipo, lang) { return txt(TITULOS[tipo], lang); }
export function labelDe(pregunta, lang) { return txt(pregunta.label, lang); }
export function opcionesDe(pregunta, lang) { return pregunta.opciones ? txt(pregunta.opciones, lang) : null; }
