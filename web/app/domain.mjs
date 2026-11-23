export const TYPES = Object.freeze({
  diabetic: 'Ferida diabética',
  pressure: 'Lesão por pressão',
  surgical: 'Ferida cirúrgica',
  venous: 'Ferida venosa',
  no_wound: 'Imagem sem ferida visível',
});

export const VISUAL = Object.freeze({
  redness: 'Área avermelhada ao redor da lesão',
  yellow: 'Material amarelado visível no leito',
  swelling: 'Possível alteração de volume ao redor',
  surface_loss: 'Área com aparente perda de pele',
  dark: 'Área de coloração escura',
  incision: 'Linha compatível com uma incisão',
  no_visible_opening: 'Abertura na pele não claramente visível',
});

const tri = [['yes', 'Sim'], ['no', 'Não'], ['unknown', 'Não avaliado']];
const question = (id, label, options = tri, hint = '') => ({ id, label, options, hint });

export const QUESTIONS = [
  question('wound', 'Há uma lesão ou alteração de pele no exame?', tri, 'Inclua alterações com a pele íntegra.'),
  question('alerts', 'Há febre, piora rápida ou sinais gerais preocupantes?', [
    ['none', 'Nenhum desses sinais'], ['fever', 'Febre'], ['urgent', 'Piora rápida ou sinal geral preocupante'],
    ['unknown', 'Não avaliado'],
  ], 'Considere também calafrios, confusão, instabilidade ou dor desproporcional.'),
  question('diabeticContext', 'É uma lesão no pé de uma pessoa com diabetes?'),
  question('pressureExposure', 'A lesão está relacionada a pressão ou cisalhamento?'),
  question('surgerySite', 'A lesão corresponde ao local de uma cirurgia?'),
  question('legLocation', 'A avaliação clínica indica origem venosa para esta lesão na perna?'),
  question('purulence', 'Há secreção purulenta ao exame?'),
  question('erythema', 'Até onde vai a vermelhidão a partir da borda?', [
    ['none', 'Sem vermelhidão'], ['trace', 'Até 0,5 cm'], ['localized', 'Mais de 0,5 cm e menos de 2 cm'],
    ['extended', '2 cm ou mais'], ['unknown', 'Não aferido'],
  ]),
  question('localInflammation', 'Quantos outros sinais locais estão presentes?', [
    ['none', 'Nenhum'], ['one', 'Um'], ['multiple', 'Dois ou mais'], ['unknown', 'Não avaliado'],
  ], 'Conte calor, dor ou sensibilidade nova e edema ou endurecimento.'),
  question('depth', 'Qual profundidade foi identificada no exame?', [
    ['intact', 'Pele íntegra'], ['skin', 'Pele, sem exposição de gordura'], ['subcutaneous', 'Até o tecido subcutâneo'],
    ['deep', 'Envolvimento de estruturas profundas'], ['obscured', 'Leito encoberto, extensão indeterminada'],
    ['unknown', 'Não avaliada'],
  ]),
  question('footPerfusion', 'Como está registrada a perfusão do pé?', [
    ['adequate', 'Avaliada, sem alteração identificada'], ['concern', 'Há suspeita de comprometimento'],
    ['unknown', 'Não avaliada'],
  ]),
  question('arterialAssessment', 'A avaliação arterial permite considerar compressão?', [
    ['eligible', 'Compatível com compressão segundo a equipe'], ['concern', 'Há restrição ou suspeita de doença arterial'],
    ['unknown', 'Pendente ou indisponível'],
  ]),
  question('incisionOpening', 'Houve abertura da incisão?'),
  question('pressureTissue', 'Qual descrição corresponde ao tecido no exame?', [
    ['stage1', 'Pele íntegra com eritema não embranquecível'],
    ['stage2', 'Derme exposta ou bolha serosa, sem esfacelo ou escara'],
    ['stage3', 'Perda total da pele com gordura visível, sem estruturas profundas expostas'],
    ['stage4', 'Estrutura profunda exposta ou diretamente palpável'],
    ['unstageable', 'Esfacelo ou escara encobre a extensão da perda tissular'],
    ['deepTissue', 'Padrão clínico de dano tissular profundo'],
    ['unknown', 'Dados insuficientes'],
  ]),
  question('alternative', 'Outra causa explica a inflamação?', [
    ['excluded', 'Outras causas avaliadas e consideradas improváveis'], ['possible', 'Há outra causa possível'],
    ['unknown', 'Não avaliado'],
  ]),
  question('deepInfection', 'Há evidência clínica de infecção em tecidos profundos?'),
  question('sirs', 'Quantos critérios de SIRS foram documentados?', [
    ['zero', 'Nenhum'], ['one', 'Um'], ['multiple', 'Dois ou mais'], ['unknown', 'Dados insuficientes'],
  ]),
];

const contextQuestion = {
  diabetic: 'diabeticContext', pressure: 'pressureExposure', surgical: 'surgerySite', venous: 'legLocation',
};
const consultation = new Set(['wound', 'alerts', ...Object.values(contextQuestion)]);
const essentials = {
  diabetic: ['erythema', 'localInflammation', 'depth', 'footPerfusion'],
  pressure: ['pressureTissue'],
  surgical: ['incisionOpening'],
  venous: ['arterialAssessment'],
};
const imageCues = {
  redness: 'erythema', yellow: 'purulence', swelling: 'localInflammation',
  surface_loss: 'depth', dark: 'depth',
};

export function questionScope(type, { etiology } = {}) {
  const candidate = etiology ?? type;
  return Object.hasOwn(contextQuestion, candidate) ? candidate : null;
}

export function localSigns(exam) {
  const otherSigns = { one: 1, multiple: 2 }[exam.localInflammation] ?? 0;
  return otherSigns + Number(exam.purulence === 'yes') + Number(['localized', 'extended'].includes(exam.erythema));
}

export function questionsFor(type, findings, exam = {}) {
  const route = questionScope(type, exam);
  const context = contextQuestion[route];
  const scope = exam[context] === 'no' ? null : route;
  const basic = new Set(['wound', 'alerts']);
  const priority = new Set();
  if (exam.wound !== 'no') {
    const photoQuestions = findings.map(finding => imageCues[finding]).filter(Boolean);
    for (const id of photoQuestions) priority.add(id === 'depth' && scope === 'pressure' ? 'pressureTissue' : id);
    if (findings.includes('incision') && scope === 'surgical') priority.add('incisionOpening');

    if (context) basic.add(context);
    basic.add('purulence');
    for (const id of scope ? essentials[scope] : ['depth']) basic.add(id);
    for (const id of priority) basic.add(id);
    if (scope === 'surgical' && exam.incisionOpening === 'yes') basic.add('depth');

    if (confirmedType(exam, type) === 'diabetic') {
      const infectionSigns = localSigns(exam) >= 2;
      if (infectionSigns) basic.add('alternative');
      if (infectionSigns || exam.depth === 'deep') basic.add('deepInfection');
      if (infectionSigns || ['fever', 'urgent'].includes(exam.alerts)) basic.add('sirs');
    }
  }

  const fields = QUESTIONS.filter(({ id }) => basic.has(id));
  const examFields = fields.filter(({ id }) => !consultation.has(id));
  return [
    ...fields.filter(({ id }) => consultation.has(id)),
    ...examFields.filter(({ id }) => priority.has(id)),
    ...examFields.filter(({ id }) => !priority.has(id)),
  ].map(item => ({ ...item, group: consultation.has(item.id) ? 'consultation' : 'examination' }));
}

export function confirmedType(exam, type) {
  const scope = questionScope(type, exam);
  return scope && exam.wound === 'yes' && exam[contextQuestion[scope]] === 'yes' ? scope : null;
}

export function urgent(exam, type) {
  return exam.alerts === 'urgent' ||
    (confirmedType(exam, type) === 'diabetic' && exam.sirs === 'multiple' &&
      (localSigns(exam) >= 2 || exam.alerts === 'fever'));
}
