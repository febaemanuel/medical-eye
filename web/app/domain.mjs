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
  question('wound', 'Há uma lesão ou alteração de pele no exame?', tri, 'Considere alterações mesmo quando a pele está íntegra.'),
  question('etiology', 'Qual contexto clínico você identificou?', [
    ['diabetic', 'Ferida no pé de pessoa com diabetes'],
    ['pressure', 'Lesão relacionada a pressão ou cisalhamento'],
    ['surgical', 'Lesão no local de uma cirurgia'],
    ['venous', 'Úlcera de perna com etiologia venosa avaliada'],
    ['other', 'Outro contexto clínico'],
    ['unknown', 'Ainda não definido'],
  ]),
  question('diabetes', 'A pessoa tem diagnóstico de diabetes?'),
  question('fever', 'Houve febre relatada ou aferida?'),
  question('systemic', 'Há outros sinais sistêmicos preocupantes?', tri, 'Considere calafrios, confusão ou instabilidade.'),
  question('rapid', 'Há piora rápida, dor desproporcional ou suspeita de acometimento grave?'),
  question('footLocation', 'A lesão está no pé?'),
  question('pressureExposure', 'A história ou o exame indicam pressão ou cisalhamento na região?'),
  question('surgerySite', 'A lesão corresponde ao local de uma cirurgia registrada?'),
  question('incisionOpening', 'Houve abertura dos bordos da incisão?'),
  question('legLocation', 'A lesão fica na perna?'),
  question('venousHistory', 'Há história conhecida de doença venosa na perna?'),
  question('purulence', 'Há secreção purulenta ao exame?'),
  question('erythema', 'Até onde vai a vermelhidão a partir da borda?', [
    ['none', 'Sem eritema'],
    ['trace', 'Até 0,5 cm'],
    ['localized', 'Mais de 0,5 cm e menos de 2 cm'],
    ['extended', '2 cm ou mais'],
    ['unknown', 'Não aferido'],
  ]),
  question('depth', 'Qual profundidade foi identificada no exame?', [
    ['intact', 'Pele íntegra'],
    ['skin', 'Pele, sem exposição de gordura'],
    ['subcutaneous', 'Até o tecido subcutâneo'],
    ['deep', 'Envolvimento de estruturas profundas'],
    ['obscured', 'Leito encoberto, extensão indeterminada'],
    ['unknown', 'Não avaliada'],
  ]),
  question('warmth', 'Há aumento de temperatura local?'),
  question('pain', 'Há dor ou sensibilidade local nova ou aumentada?'),
  question('swelling', 'Há edema ou endurecimento local?'),
  question('alternative', 'Outras causas de inflamação local foram avaliadas?', [
    ['excluded', 'Avaliadas e consideradas improváveis'],
    ['possible', 'Há outra causa possível'],
    ['unknown', 'Não avaliadas'],
  ]),
  question('deepInfection', 'Há evidência clínica de infecção em tecidos profundos?'),
  question('sirs', 'Quantos critérios de SIRS foram documentados?', [
    ['zero', 'Nenhum'], ['one', 'Um'], ['multiple', 'Dois ou mais'], ['unknown', 'Dados insuficientes'],
  ]),
  question('pressureTissue', 'Qual descrição corresponde ao tecido no exame?', [
    ['stage1', 'Pele íntegra com eritema não embranquecível'],
    ['stage2', 'Derme exposta ou bolha serosa, sem esfacelo ou escara'],
    ['stage3', 'Perda total da pele com gordura visível, sem estruturas profundas expostas'],
    ['stage4', 'Estrutura profunda exposta ou diretamente palpável'],
    ['unstageable', 'Esfacelo ou escara encobre a extensão da perda tissular'],
    ['deepTissue', 'Padrão clínico de dano tissular profundo'],
    ['unknown', 'Dados insuficientes'],
  ]),
];

const contextFields = new Set([
  'wound', 'etiology', 'diabetes', 'fever', 'systemic', 'rapid',
  'footLocation', 'pressureExposure', 'surgerySite', 'legLocation', 'venousHistory',
]);
const noWoundFields = new Set(['wound', 'diabetes', 'fever', 'systemic', 'rapid']);
const specificFields = {
  footLocation: 'diabetic', alternative: 'diabetic', deepInfection: 'diabetic', sirs: 'diabetic',
  pressureExposure: 'pressure', pressureTissue: 'pressure',
  surgerySite: 'surgical', incisionOpening: 'surgical', legLocation: 'venous', venousHistory: 'venous',
};
const imageCues = {
  redness: ['erythema'], yellow: ['purulence'], swelling: ['swelling'],
  surface_loss: ['depth'], dark: ['depth'], no_visible_opening: ['wound'], incision: ['incisionOpening'],
};

export function questionScope(type, { etiology } = {}) {
  if (etiology === 'other') return null;
  const candidate = etiology && etiology !== 'unknown' ? etiology : type;
  return candidate !== 'no_wound' && Object.hasOwn(TYPES, candidate) ? candidate : null;
}

export function questionsFor(type, findings, exam = {}) {
  const scope = questionScope(type, exam);
  const cues = new Set(findings.flatMap(value => imageCues[value] || []));
  const fields = QUESTIONS.filter(({ id }) => {
    if (exam.wound === 'no') return noWoundFields.has(id);
    return !Object.hasOwn(specificFields, id) || specificFields[id] === scope;
  });
  const consultation = fields.filter(({ id }) => contextFields.has(id));
  const local = fields.filter(({ id }) => !contextFields.has(id));
  return [
    ...consultation,
    ...local.filter(({ id }) => cues.has(id)),
    ...local.filter(({ id }) => !cues.has(id)),
  ].map(item => ({
    ...item,
    group: contextFields.has(item.id) ? 'consultation' : 'examination',
    fromImage: cues.has(item.id),
  }));
}

export function confirmedType(exam) {
  if (exam.wound !== 'yes') return null;
  const requiredContext = {
    diabetic: ['diabetes', 'footLocation'],
    pressure: ['pressureExposure'],
    surgical: ['surgerySite'],
    venous: ['legLocation'],
  }[exam.etiology];
  return requiredContext?.every(id => exam[id] === 'yes') ? exam.etiology : null;
}

export function urgent(exam) {
  return exam.systemic === 'yes' || exam.rapid === 'yes' ||
    (confirmedType(exam) === 'diabetic' && exam.sirs === 'multiple');
}
