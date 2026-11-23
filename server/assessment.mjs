import { PROTOCOLS } from '../web/data/protocolos.mjs';
import { TYPES, VISUAL, urgent } from '../web/app/domain.mjs';

const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const words = value => normalize(value).match(/[a-z][a-z0-9]{2,}/g) || [];

const signalTerms = {
  purulence: 'secreção purulência', erythema: 'vermelhidão eritema', depth: 'profundidade tecido',
  warmth: 'calor', pain: 'dor', swelling: 'edema', systemic: 'sistêmico urgência',
  rapid: 'piora urgência', sirs: 'sistêmico sirs', pressureTissue: 'derme estágio pressão',
  deepInfection: 'infecção profundidade',
};

export function retrieve(caseData, corpus = PROTOCOLS) {
  const { type, findings, exam } = caseData;
  if (exam.wound === 'no') return [];
  const scope = exam.etiology && exam.etiology !== 'unknown' ? exam.etiology : type;
  const terms = new Set(words([
    TYPES[scope] || '', ...findings.map(item => VISUAL[item] || ''),
    ...Object.entries(exam).filter(([, value]) => !['unknown', 'no', 'none', 'zero'].includes(value))
      .map(([key]) => signalTerms[key] || ''),
  ].join(' ')));
  // Limit clinical guidance to the case's scope, then rank text and tags locally.
  return corpus.filter(item => item.type === scope || item.type === 'general').map(item => {
    const tags = new Set(words(item.tags.join(' ')));
    const passage = new Set(words(item.text + ' ' + item.section));
    const score = (item.type === scope ? 4 : 0) + [...terms].reduce((sum, term) =>
      sum + (tags.has(term) ? 2 : 0) + (passage.has(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(({ item }) => item);
}

const pressureStages = {
  stage1: 'Estágio 1',
  stage2: 'Estágio 2',
  stage3: 'Estágio 3',
  stage4: 'Estágio 4',
  unstageable: 'Lesão por pressão não classificável',
  deepTissue: 'Lesão tissular profunda',
};

const pressureDepth = {
  stage1: ['intact'], stage2: ['skin'], stage3: ['subcutaneous'], stage4: ['deep'],
  unstageable: ['obscured'], deepTissue: ['intact', 'skin', 'unknown'],
};

const hypothesisFor = {
  diabetic: 'Lesão do pé em pessoa com diabetes',
  pressure: 'Lesão por pressão',
  surgical: 'Complicação em ferida cirúrgica',
  venous: 'Úlcera de perna de etiologia venosa',
};

function localSigns(exam) {
  return [exam.purulence, exam.warmth, exam.pain, exam.swelling].filter(value => value === 'yes').length +
    Number(['localized', 'extended'].includes(exam.erythema));
}

export function clinicalAssessment(exam) {
  const insufficient = 'Dados insuficientes';
  const urgency = urgent(exam);
  if (exam.wound === 'no') {
    return { stage: 'Sem lesão identificada ao exame', infection: 'Não avaliada neste fluxo', urgency };
  }
  const confirmed = exam.wound === 'yes';
  const etiology = confirmed ? exam.etiology : undefined;
  const stage = etiology === 'pressure'
    ? (pressureDepth[exam.pressureTissue]?.includes(exam.depth) ? pressureStages[exam.pressureTissue] : insufficient)
    : (hypothesisFor[etiology] ? 'Estadiamento específico não aplicado' : insufficient);
  const signs = localSigns(exam);
  let infection = insufficient;

  if (confirmed && etiology === 'diabetic') {
    const assessedNegative = ['purulence', 'warmth', 'pain', 'swelling', 'systemic', 'rapid'].every(id => exam[id] === 'no') &&
      exam.erythema === 'none' && exam.sirs === 'zero' && exam.deepInfection === 'no';
    if (assessedNegative) infection = 'Sem sinais clínicos registrados · IWGDF/IDSA 1';
    if (signs >= 2 && exam.alternative === 'excluded') {
      if (exam.sirs === 'multiple') infection = 'Grave · IWGDF/IDSA 4';
      if (exam.systemic === 'no' && ['zero', 'one'].includes(exam.sirs)) {
        if (exam.erythema === 'extended' || exam.deepInfection === 'yes') infection = 'Moderada · IWGDF/IDSA 3';
        else if (['none', 'trace', 'localized'].includes(exam.erythema) && exam.deepInfection === 'no') {
          infection = 'Leve · IWGDF/IDSA 2';
        }
      }
    }
  } else if (confirmed && signs > 0) {
    infection = 'Sinais locais registrados · gravidade indeterminada';
  }

  return { stage, infection, urgency };
}

const conduct = {
  diabetic: ['Revisar os sinais locais e a extensão da lesão com o protocolo de pé diabético.', 'iwgdf-exame'],
  pressure: ['Rever o estadiamento no exame e discutir alívio de pressão e reposicionamento individualizado.', 'anvisa-prevencao'],
  surgical: ['Reavaliar a incisão e discutir os sinais pós-operatórios com a equipe responsável.', 'nice-incisao'],
  venous: ['Reavaliar os sinais de infecção e o manejo da etiologia da úlcera de perna.', 'nice-ulcera'],
};

export function draftReport(caseData, references, assessment = clinicalAssessment(caseData.exam)) {
  const { exam, type } = caseData;
  const ids = new Set(references.map(item => item.id));
  const section = (text, ref) => ({ text, refs: ids.has(ref) ? [ref] : [] });
  const scope = exam.wound === 'yes' ? exam.etiology : undefined;
  const hypothesis = exam.wound === 'no'
    ? 'Nenhuma lesão identificada no exame registrado'
    : hypothesisFor[scope] || 'Hipótese indeterminada com os dados registrados';
  const action = conduct[scope];
  const firstSource = { diabetic: 'iwgdf-exame', pressure: 'anvisa-estagios', surgical: 'nice-incisao', venous: 'nice-ulcera' }[scope];
  const sourceForUrgent = { diabetic: 'iwgdf-urgencia', venous: 'nice-ulcera-urgencia', surgical: 'nice-incisao' }[scope];
  const suggestions = [];
  if (assessment.urgency) suggestions.push(section('Priorizar avaliação presencial urgente e acionar o protocolo local conforme o exame.', sourceForUrgent));
  if (action && ids.has(action[1])) suggestions.push(section(...action));
  if (!suggestions.length) suggestions.push(section('Rever a história e o exame antes de propor conduta específica.'));
  return {
    hypothesis: section(hypothesis, firstSource),
    stage: section(assessment.stage, scope === 'pressure' ? 'anvisa-estagios' : undefined),
    infection: section(assessment.infection, scope === 'pressure' ? undefined : firstSource),
    rationale: section(scope
      ? 'A hipótese considera a etiologia registrada no exame. A leitura da foto serve para orientar perguntas.'
      : type === 'no_wound' ? 'O resultado da imagem descreve o enquadramento e depende de confirmação no exame.'
        : 'A hipótese depende da avaliação clínica da lesão e do seu contexto.', firstSource),
    suggestions,
    assessment,
    references,
  };
}
