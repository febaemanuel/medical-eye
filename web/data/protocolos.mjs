import { TREATMENT_SOURCES } from './treatment.mjs';

const anvisa = 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-gvims-ggtes-anvisa-no-05-2023-praticas-de-seguranca-do-paciente-em-servicos-de-saude-prevencao-de-lesao-por-pressao/';
const iwgdf = 'https://doi.org/10.1093/cid/ciad527';
const niceLeg = 'https://www.nice.org.uk/guidance/ng152/chapter/recommendations';
const niceSurgical = 'https://www.nice.org.uk/guidance/ng125/chapter/recommendations';
const niceSepsis = 'https://www.nice.org.uk/guidance/ng253/chapter/Evaluating-risk';
const cofen = 'https://www.cofen.gov.br/wp-content/uploads/2025/08/Resolucao-Cofen-no-787-2025-Regulamenta-a-atuacao-da-equipe-de-enfermagem-na-promocao-prevencao-tratamento-e-reabilitacao-de-pessoas-com-Lesoes-Cutaneas.pdf#page=3';

export const PROTOCOLS = [
  {
    id: 'iwgdf-exame', type: 'diabetic', organization: 'IWGDF / IDSA', year: 2023,
    document: 'iwgdf-infection', page: 13,
    title: 'Infecção do pé relacionada ao diabetes', section: 'Recomendação 1 e tabela 1', url: iwgdf,
    text: 'A avaliação de infecção do pé em pessoas com diabetes usa achados clínicos. A tabela 1 considera secreção purulenta, calor, dor, edema ou induração e extensão do eritema. Também orienta a considerar causas alternativas de inflamação e a avaliar o envolvimento profundo e a resposta sistêmica.',
    tags: ['secreção', 'vermelhidão', 'profundidade', 'SIRS', 'diabetes'],
    guidance: {
      diabeticContext: 'Confirme pelo exame que a lesão está no pé e consulte a história clínica ou o prontuário para verificar o diagnóstico de diabetes.',
      localInflammation: 'Conte separadamente a presença de calor local, dor ou sensibilidade nova e edema ou endurecimento. A vermelhidão e a secreção são registradas em perguntas próprias.',
      erythema: 'A tabela 1 considera a extensão do eritema em qualquer direção a partir da margem da ferida. Registre a distância aferida no exame.',
      purulence: 'Verifique no exame se há secreção purulenta. Material amarelado visível na foto pode justificar a inspeção do exsudato.',
      deepInfection: 'Avalie se os sinais de infecção envolvem tecidos além da pele e do subcutâneo. Registre a profundidade anatômica da ferida no campo próprio.',
      alternative: 'Considere causas alternativas para a inflamação local, como trauma, gota, artropatia de Charcot, fratura, trombose ou estase venosa.',
      sirs: 'Consulte os critérios da tabela 1 para temperatura, frequência cardíaca, respiração e leucócitos. Se faltar informação para a contagem, registre dados insuficientes.',
    },
  },
  {
    id: 'iwgdf-urgencia', type: 'diabetic', organization: 'IWGDF / IDSA', year: 2023,
    document: 'iwgdf-infection', page: 30,
    title: 'Infecção do pé relacionada ao diabetes', section: 'Recomendações 2 e 18, tabela 2', url: iwgdf,
    text: 'A diretriz recomenda avaliação cirúrgica urgente para infecção grave ou infecção moderada com complicações como gangrena extensa, sinais de abscesso profundo, infecção necrosante ou isquemia grave. A necessidade de hospitalização depende da gravidade e das comorbidades relevantes.',
    tags: ['sistêmico', 'urgência', 'piora', 'profundidade', 'necrose'],
  },
  {
    id: 'anvisa-estagios', type: 'pressure', organization: 'Anvisa', year: 2023,
    document: 'anvisa-pressure', page: 7,
    title: 'Prevenção de lesão por pressão', section: 'Nota técnica 05/2023, seção 1.1, p. 7–8', url: anvisa,
    text: 'O estadiamento pressupõe uma lesão por pressão identificada na avaliação clínica. Examina-se a integridade da pele, quais tecidos estão expostos, a presença de escara ou esfacelo que encobre a perda tissular e os sinais de dano tissular profundo.',
    tags: ['derme', 'tecido', 'estágio', 'pressão', 'profundidade'],
    guidance: {
      wound: 'A inspeção deve considerar alterações com pele íntegra, como eritema não embranquecível ou sinais de dano tissular profundo.',
      depth: 'Identifique os tecidos visíveis no exame. Registre leito encoberto se a escara ou o esfacelo impedir a avaliação da extensão.',
      pressureTissue: 'Compare os tecidos avaliados com as descrições da Anvisa. Registre a integridade da pele, exposição de derme, gordura ou estruturas profundas e eventual tecido que encubra o leito.',
    },
  },
  {
    id: 'anvisa-prevencao', type: 'pressure', organization: 'Anvisa', year: 2023,
    document: 'anvisa-pressure',
    title: 'Prevenção de lesão por pressão', section: 'Nota técnica 05/2023, definição e prevenção', url: anvisa,
    text: 'Lesões por pressão envolvem pressão prolongada ou intensa, isolada ou combinada com cisalhamento. A prevenção inclui inspeção da pele, avaliação de risco, superfícies de suporte e reposicionamento individualizado.',
    tags: ['pressão', 'cisalhamento', 'reposicionamento', 'pele'],
    guidance: {
      pressureExposure: 'Pergunte sobre posicionamento, mobilidade e uso de dispositivos que exerçam pressão no local. Relacione essas informações à área examinada.',
    },
  },
  {
    id: 'nice-incisao', type: 'surgical', organization: 'NICE', year: 2019,
    document: 'nice-surgery', page: 22,
    title: 'Infecção de sítio cirúrgico', section: 'NG125, seção 1.4 e definições', url: niceSurgical,
    text: 'A infecção de sítio cirúrgico pode apresentar calor, eritema, dor e edema ao redor da incisão, com manifestações sistêmicas em casos mais graves. A avaliação deve considerar profundidade, contexto pós-operatório e os achados ao redor da ferida.',
    tags: ['incisão', 'cirurgia', 'secreção', 'calor', 'sistêmico'],
    guidance: {
      surgerySite: 'Confirme o procedimento e o local da incisão no histórico ou prontuário, e relacione-os ao local da alteração observada.',
    },
  },
  {
    id: 'nice-ulcera', type: 'venous', organization: 'NICE', year: 2020,
    document: 'nice-leg',
    title: 'Infecção de úlcera de perna', section: 'NG152, itens 1.1.1–1.1.3', url: niceLeg,
    text: 'A avaliação de infecção de úlcera da perna considera sinais como eritema ou edema além da borda, calor localizado, dor crescente ou febre. A avaliação também precisa considerar as condições de base, como insuficiência venosa e edema.',
    tags: ['venosa', 'eritema', 'edema', 'calor', 'úlcera'],
    guidance: {
      legLocation: 'Considere a localização, a avaliação clínica da circulação e a história de doença venosa antes de registrar a causa provável.',
      erythema: 'Observe se a vermelhidão se estende além da úlcera e registre a extensão aferida.',
    },
  },
  {
    id: 'nice-ulcera-urgencia', type: 'venous', organization: 'NICE', year: 2020,
    document: 'nice-leg',
    title: 'Infecção de úlcera de perna', section: 'NG152, itens 1.1.8–1.1.13', url: niceLeg,
    text: 'Reavalie em caso de piora rápida, comprometimento sistêmico ou dor intensa desproporcional. Suspeita de sepse, fasciíte necrosante ou osteomielite é motivo de avaliação hospitalar.',
    tags: ['venosa', 'urgência', 'piora', 'sistêmico', 'dor'],
  },
  {
    id: 'cofen-registro', type: 'general', organization: 'Cofen', year: 2025,
    document: 'cofen-787', page: 3,
    title: 'Atuação da enfermagem no cuidado às pessoas com lesões cutâneas', section: 'Resolução 787/2025, anexo, capítulo I', url: cofen,
    text: 'O registro da avaliação de uma lesão inclui etiologia, tipo de tecido, achados relacionados à infecção ou inflamação, exsudato, bordas e condição da pele ao redor.',
    tags: ['história', 'avaliação', 'tecido', 'exsudato', 'bordas', 'pele'],
    guidance: {
      wound: 'Inspecione a região e a pele ao redor e registre se há alteração objetiva no exame.',
      depth: 'Registre os tecidos reconhecidos durante a avaliação. Se a extensão estiver encoberta, indique a limitação do exame.',
      purulence: 'Observe diretamente o exsudato e registre sua aparência. Use esta pergunta para registrar se a secreção purulenta foi confirmada.',
      erythema: 'Observe a pele ao redor e registre a extensão da vermelhidão em relação às bordas, quando for possível aferi-la.',
    },
  },
  {
    id: 'nice-sinais', type: 'general', organization: 'NICE', year: 2025,
    document: 'nice-sepsis',
    title: 'Suspeita de sepse em pessoas com 16 anos ou mais', section: 'NG253, avaliação de risco', url: niceSepsis,
    text: 'A avaliação de risco considera história, evolução, sinais vitais, alterações do estado mental e possíveis focos de infecção. Alterações no sítio cirúrgico incluem vermelhidão, edema, secreção ou abertura da ferida.',
    tags: ['febre', 'sistêmico', 'piora', 'urgência', 'sinais', 'temperatura'],
    guidance: {
      alerts: 'Verifique os sinais vitais, a evolução da lesão, o estado mental e a temperatura, quando disponível. Diante de sinais preocupantes, consulte o protocolo local.',
      incisionOpening: 'Inspecione a incisão e registre se houve abertura da ferida, além de alterações de cor, edema ou secreção quando presentes.',
    },
  },
  {
    id: 'nice-pele', type: 'general', organization: 'NICE', year: 2019,
    title: 'Celulite e erisipela, orientações de avaliação', section: 'NG141, itens 1.1.1–1.1.7', url: 'https://www.nice.org.uk/guidance/ng141/chapter/recommendations',
    text: 'Na avaliação de inflamação da pele, considere causas alternativas, como eczema, insuficiência venosa crônica ou reação inflamatória. Observe a extensão da vermelhidão, do edema e a evolução da dor.',
    tags: ['calor', 'edema', 'dor', 'eritema', 'pele'],
    guidance: {
      localInflammation: 'Observe se há calor, dor nova ou crescente e edema ou endurecimento. Compare com a região ao redor e com o quadro anterior, quando conhecido.',
    },
  },
  ...TREATMENT_SOURCES,
];
