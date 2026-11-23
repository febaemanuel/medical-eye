import { PROTOCOLS } from '../web/data/protocolos.mjs';
import { TYPES, VISUAL, VISUAL_REVIEW, confirmedType, questionScope, questionsFor, urgent } from '../web/app/domain.mjs';
import { guidanceFor } from '../web/app/evidence.mjs';

const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const words = value => normalize(value).match(/[a-z][a-z0-9]{2,}/g) || [];

const signalTerms = {
  purulence: 'secreção purulência', erythema: 'vermelhidão eritema', depth: 'profundidade tecido',
  warmth: 'calor', pain: 'dor', swelling: 'edema', systemic: 'sistêmico urgência',
  fever: 'febre temperatura', rapid: 'piora urgência', sirs: 'sistêmico sirs', pressureTissue: 'derme estágio pressão',
  deepInfection: 'infecção profundidade',
};

export function retrieve(caseData, corpus = PROTOCOLS) {
  const { type, findings, exam } = caseData;
  const scope = exam.wound === 'no' ? null : questionScope(type, exam);
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
  surgical: 'Lesão em ferida cirúrgica',
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
  const etiology = confirmedType(exam);
  const stage = etiology === 'pressure'
    ? (pressureDepth[exam.pressureTissue]?.includes(exam.depth) ? pressureStages[exam.pressureTissue] : insufficient)
    : (hypothesisFor[etiology] ? 'Estadiamento específico não aplicado' : insufficient);
  const signs = localSigns(exam);
  let infection = insufficient;

  if (confirmed && etiology === 'diabetic') {
    const assessedNegative = ['purulence', 'warmth', 'pain', 'swelling', 'fever', 'systemic', 'rapid'].every(id => exam[id] === 'no') &&
      exam.erythema === 'none' && exam.sirs === 'zero' && exam.deepInfection === 'no';
    if (assessedNegative) infection = 'Sem sinais clínicos registrados · IWGDF/IDSA 1';
    if (signs >= 2 && exam.alternative === 'excluded') {
      if (exam.sirs === 'multiple') infection = 'Grave · IWGDF/IDSA 4';
      if (exam.systemic === 'no' && exam.fever === 'no' && ['zero', 'one'].includes(exam.sirs)) {
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

function treatmentFor(scope, exam, assessment) {
  switch (scope) {
    case 'diabetic': {
      const plantar = exam.plantar === 'yes' && exam.neuropathy === 'yes';
      const offloading = exam.footPerfusion !== 'adequate'
        ? 'Confira a avaliação vascular e os critérios de infecção antes de selecionar a descarga. A diretriz tem opções diferentes conforme esses achados.'
        : plantar
          ? 'Localização plantar e neuropatia foram registradas. Compare as opções para esse perfil e confirme tolerância, infecção e contraindicações com a equipe.'
          : 'Consulte a opção de descarga correspondente à localização e à avaliação de sensibilidade do pé.';
      const infection = assessment.infection.includes('IWGDF/IDSA 1')
        ? 'O exame registrou ausência dos sinais avaliados. Consulte a recomendação 11 sobre o papel dos antibióticos em úlcera clinicamente não infectada.'
        : 'Confira se os achados clínicos preenchem os critérios de infecção e de gravidade antes de discutir antimicrobianos.';
      return [
        ['Descarga de pressão', offloading, ['iwgdf-perfusao', 'lazzarini-descarga']],
        ['Cuidado local e cicatrização', 'Confira as condições do leito e o exsudato para discutir a cobertura e a necessidade de desbridamento.', ['iwgdf-cicatrizacao']],
        ['Infecção e antimicrobianos', infection, ['iwgdf-exame', 'iwgdf-antibioticos']],
      ];
    }
    case 'pressure':
      return [['Alívio de pressão e cuidado local', 'Revise mobilidade, superfície de suporte, tecido e exsudato com a equipe para escolher as medidas de alívio e cuidado local.', ['nice-pressao-tratamento', 'anvisa-prevencao']]];
    case 'surgical':
      return [['Cuidado da incisão', exam.incisionOpening === 'yes'
        ? 'Foi registrada abertura da incisão. Revise profundidade e sinais locais com a equipe cirúrgica e consulte o cuidado para cicatrização por segunda intenção.'
        : 'Use o intervalo desde a cirurgia e o exame da incisão para consultar os cuidados de limpeza, cobertura e reavaliação.', ['nice-cirurgia-tratamento']]];
    case 'venous':
      return [['Avaliação arterial e compressão', exam.arterialAssessment === 'eligible'
        ? 'A equipe registrou elegibilidade para compressão. Compare as opções para o perfil avaliado e a evidência sobre os sistemas estudados.'
        : 'Revise a avaliação arterial e as restrições com a equipe antes de selecionar a modalidade de compressão.', ['esvs-compressao', 'venus-6']],
      ['Avaliação de infecção da úlcera de perna', 'Confira os sinais locais e sistêmicos registrados e compare com os critérios de avaliação e reavaliação da diretriz.', ['nice-ulcera', 'nice-ulcera-urgencia']]];
    default:
      return [];
  }
}

export function draftReport(caseData) {
  const { exam, type, findings, visualReview = {} } = caseData;
  const assessment = clinicalAssessment(exam);
  const scope = confirmedType(exam);
  const referencesById = new Map(retrieve(caseData).map(ref => [ref.id, ref]));
  const appendReference = ref => {
    if (ref) referencesById.set(ref.id, ref);
  };
  const section = (text, refId) => {
    const ref = PROTOCOLS.find(item => item.id === refId);
    appendReference(ref);
    return { text, refs: ref ? [ref.id] : [] };
  };

  const examination = [];
  const pending = [];
  for (const question of questionsFor(type, findings, exam)) {
    const answer = question.options.find(([value]) => value === exam[question.id])?.[1];
    if (!answer) continue;
    const entry = { question: question.label, answer };
    if (exam[question.id] === 'unknown') {
      const guidance = guidanceFor(question.id, type, exam);
      appendReference(guidance?.reference);
      pending.push({ ...entry, refs: guidance ? [guidance.reference.id] : [] });
    } else {
      examination.push(entry);
    }
  }

  const hypothesis = exam.wound === 'no'
    ? 'Nenhuma lesão identificada no exame registrado'
    : hypothesisFor[scope] || 'Hipótese indeterminada com os dados registrados';
  const firstSource = {
    diabetic: 'iwgdf-exame', pressure: 'anvisa-estagios', surgical: 'nice-incisao', venous: 'nice-ulcera',
  }[scope];
  const sourceForUrgent = { diabetic: 'iwgdf-urgencia', venous: 'nice-ulcera-urgencia' }[scope] || 'nice-sinais';
  const suggestions = [];
  if (assessment.urgency) {
    suggestions.push(section('Priorizar avaliação presencial urgente conforme o protocolo local.', sourceForUrgent));
  } else if (exam.fever === 'yes') {
    suggestions.push(section('Revisar a febre, a evolução clínica e os demais sinais sistêmicos conforme o protocolo local.', 'nice-sinais'));
  }
  if (conduct[scope]) suggestions.push(section(...conduct[scope]));
  if (!suggestions.length) suggestions.push(section('Rever a história e o exame antes de propor conduta específica.'));

  const treatment = treatmentFor(scope, exam, assessment).map(([title, text, refs]) => {
    for (const id of refs) appendReference(PROTOCOLS.find(ref => ref.id === id));
    return { title, text, refs };
  });

  const report = {
    hypothesis: section(hypothesis, firstSource),
    stage: section(assessment.stage, scope === 'pressure' ? 'anvisa-estagios' : undefined),
    infection: section(assessment.infection, scope === 'pressure' ? undefined : firstSource),
    rationale: section(scope
      ? 'O resumo considera o contexto, a história e os achados registrados no exame.'
      : 'O contexto clínico depende da confirmação da lesão, da história e dos achados do exame.', firstSource),
    suggestions,
    treatment,
    visualReview: findings.map(id => ({ label: VISUAL[id], status: VISUAL_REVIEW[visualReview[id]] || 'Aguardando revisão' })),
    examination,
    pending,
    assessment,
  };
  return { ...report, references: [...referencesById.values()] };
}
