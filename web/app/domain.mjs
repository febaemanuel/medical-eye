export const TYPES = Object.freeze({
  diabetic: 'Ferida diabética',
  pressure: 'Lesão por pressão',
  surgical: 'Ferida cirúrgica',
  venous: 'Ferida venosa',
  no_wound: 'Imagem sem ferida',
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
  question('wound', 'Há uma lesão identificável no exame?'),
  question('etiology', 'Qual contexto clínico foi identificado?', [
    ['diabetic', 'Ferida no pé de pessoa com diabetes'],
    ['pressure', 'Pressão ou cisalhamento como causa clínica'],
    ['surgical', 'Lesão relacionada a uma incisão cirúrgica'],
    ['venous', 'Úlcera de perna com etiologia venosa avaliada'],
    ['other', 'Outro contexto clínico'],
    ['unknown', 'Contexto indeterminado'],
  ], 'Considere história, localização e exame.'),
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
  question('systemic', 'Há sinais sistêmicos preocupantes?', tri, 'Por exemplo, febre, calafrios, confusão ou instabilidade.'),
  question('rapid', 'Há piora rápida, dor desproporcional ou suspeita de acometimento grave?', tri, 'Considere suspeita clínica de infecção profunda, isquemia grave ou necrose progressiva.'),
  question('alternative', 'Outras causas de inflamação local foram avaliadas?', [
    ['excluded', 'Avaliadas e consideradas improváveis'],
    ['possible', 'Há outra causa possível'],
    ['unknown', 'Não avaliadas'],
  ]),
  question('deepInfection', 'Há evidência clínica de infecção em tecidos profundos?', tri,
    'Registre o envolvimento infeccioso, além da profundidade anatômica da ferida.'),
  question('sirs', 'Quantos critérios de SIRS foram documentados?', [
    ['zero', 'Nenhum'], ['one', 'Um'], ['multiple', 'Dois ou mais'], ['unknown', 'Dados insuficientes'],
  ], 'Use os critérios clínicos e laboratoriais da classificação IWGDF/IDSA, tabela 1.'),
  question('pressureTissue', 'Qual descrição corresponde ao tecido no exame?', [
    ['stage1', 'Pele íntegra com eritema não embranquecível'],
    ['stage2', 'Derme exposta ou bolha serosa, sem esfacelo ou escara'],
    ['stage3', 'Perda total da pele com gordura visível, sem estruturas profundas expostas'],
    ['stage4', 'Estrutura profunda exposta ou diretamente palpável'],
    ['unstageable', 'Esfacelo ou escara encobre a extensão da perda tissular'],
    ['deepTissue', 'Padrão clínico de dano tissular profundo'],
    ['unknown', 'Dados insuficientes'],
  ], 'Consulte os critérios completos da Anvisa antes de definir o estágio.'),
];

export function questionsFor(type, findings, exam = {}) {
  const { etiology } = exam;
  const scope = etiology && etiology !== 'unknown' ? etiology : type;
  const cues = new Set(findings.flatMap(value => ({
    redness: ['erythema'], yellow: ['purulence'], swelling: ['swelling'],
    surface_loss: ['depth'], dark: ['depth'], no_visible_opening: ['wound'], incision: ['etiology'],
  })[value] || []));
  const base = QUESTIONS.filter(({ id }) => {
    if (exam.wound === 'no') return ['wound', 'systemic', 'rapid'].includes(id);
    if (id === 'pressureTissue') return scope === 'pressure';
    if (['sirs', 'alternative', 'deepInfection'].includes(id)) return scope === 'diabetic';
    return true;
  });
  const first = ['wound', 'etiology', 'systemic', 'rapid'];
  return [
    ...first.map(id => base.find(item => item.id === id)).filter(Boolean),
    ...base.filter(({ id }) => !first.includes(id) && cues.has(id)),
    ...base.filter(({ id }) => !first.includes(id) && !cues.has(id)),
  ].map(item => ({ ...item, fromImage: cues.has(item.id) }));
}

export function urgent(exam) {
  return exam.systemic === 'yes' || exam.rapid === 'yes' ||
    (exam.wound !== 'no' && exam.etiology === 'diabetic' && exam.sirs === 'multiple');
}
