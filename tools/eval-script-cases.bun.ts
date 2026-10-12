/**
 * The §0S eval (Part II of MYBPM-IMPORTS.md): generic «write me a script» tasks for a context-free model.
 * Writes, for every case, `<runDir>/caseNN/prompt.txt` (the whole prompt for the subagent) and
 * `<runDir>/caseNN/spec.json` (what the task supplied — the grader `tools/validate-script.bun.ts --spec` checks
 * external ids against it). The matrix and the results live in `tools/eval-cases.md` «Part II».
 *
 *   bun tools/eval-script-cases.bun.ts <runDir> [41,42,…]
 */
const [run, list] = Bun.argv.slice(2);
if (!run) { console.error("usage: bun tools/eval-script-cases.bun.ts <runDir> [41,42,…]"); process.exit(2); }

const T = { Text: { baseType: "String", isArray: false, type: "Text" }, Number: { baseType: "BigDecimal", isArray: false, type: "Number" },
  Bool: { baseType: "Boolean", isArray: false, type: "Bool" } } as const;
const bo = (code: string) => ({ baseType: "BoiRefCode", boCode: code, isArray: false, type: "Bo" });

/** The copy of an EMPTY method as the IDE gives it: the envelope with the hat alone. */
function hat(name: string, ps: [string, string, any][], ret: any) {
  const id = "hAt" + name.replace(/[^A-Za-z0-9]/g, "").padEnd(13, "0").slice(0, 13);
  return JSON.stringify({ copiedType: "SCRIPT_BLOCKS", mouseX: 202, mouseY: 62, startBlockIds: [id], blocks: { [id]: {
    x: 55, y: 44, methodName: name,
    params: Object.fromEntries(ps.map(([pid, n, t], i) => [pid, { name: n, order: i + 1, type: t }])),
    returnType: ret, type: "BlockFixMethod" } }, expressions: {} });
}
const tp = (t: any) => t.type === "Bo" ? "Bo" : t.type;
const specOf = (kind: string, ps: [string, string, any][] = [], fields: Record<string, string> = {}, extra: any = {}) =>
  ({ kind, params: Object.fromEntries(ps.map(([pid, , t]) => [pid, tp(t)])), fields, ...extra });

type Case = { id: string; cell: string; task: string; spec: any; intent: string };
const P = {
  text: ["wXJkHQupHDTImFXb", "text", T.Text] as [string, string, any],
  n: ["eC1mR83irJ1FhmHB", "n", T.Number] as [string, string, any],
  iin: ["m1EXFAcQxR39krPj", "iin", T.Text] as [string, string, any],
  order: ["Bqj9m~ybzHfEcdfT", "order", bo("Order")] as [string, string, any],
  last: ["qlPRfVdFhqG07iX2", "last_name", T.Text] as [string, string, any],
  first: ["pZGW0rv1qSGs7ye@", "first_name", T.Text] as [string, string, any],
  middle: ["AtJQflusbmBr0luA", "middle_name", T.Text] as [string, string, any],
  code: ["AZbD~LQOts~nODdE", "code", T.Text] as [string, string, any],
  amount: ["aUvR@W6CAeWXHxFC", "amount", T.Number] as [string, string, any],
  order2: ["pO99S0HFNtNtelfQ", "order", bo("Order")] as [string, string, any],
  iin2: ["IfesgUKIz9tdxM8f", "iin", T.Text] as [string, string, any],
};
const ARROW_DIR = "pZrV43sj6nfqT@Y9", ARROW_HEAD = "tBxbl@0W1HWszwGu", ARROW_ONE = "HWZRT@Ogbe35wQpu";

const cases: Case[] = [
  { id: "41", cell: "S terse, nothing supplied",
    task: "Напиши метод, который считает количество гласных букв в тексте.",
    spec: specOf("method"),
    intent: "asks for the copy of the empty method first (0S.2 step 2); cannot ask → what does it deliver?" },
  { id: "42", cell: "S spec + copy",
    task: `Напиши тело метода count_vowels: он возвращает количество гласных (русских и латинских, любого регистра) в тексте.
Копия пустого метода из IDE:
${hat("count_vowels", [P.text], T.Number)}`,
    spec: specOf("method", [P.text]),
    intent: "rule 4 first block, counted loop over #Длина, #Подстрока(i-1,i), regex/contains per char, counter Plus, one FROM_METHOD at the end, hat stripped" },
  { id: "43", cell: "S spec + copy (trap: rule 1)",
    task: `Напиши тело метода is_even: возвращает Да, если число n чётное, иначе Нет.
Копия пустого метода из IDE:
${hat("is_even", [P.n], T.Bool)}`,
    spec: specOf("method", [P.n]),
    intent: "Not(#не чётное ли?) — never Eq on numbers, no Eq on a boolean" },
  { id: "44", cell: "S spec + copy",
    task: `Напиши тело метода is_valid_iin: ИИН корректен, если это ровно 12 цифр. Вернуть Да/Нет.
Копия пустого метода из IDE:
${hat("is_valid_iin", [P.iin], T.Bool)}`,
    spec: specOf("method", [P.iin]),
    intent: "regex ^[0-9]{12}$ on '' ⊕ iin (or the param straight into the String act), Bool return, one FROM_METHOD" },
  { id: "45", cell: "M spec, hook",
    task: `БО «Заявка» (код Request). Поля: «Сумма» — число, код amount; «Требует согласования» — галочка, код needs_approval.
Нужен скрипт на событие «При сохранении»: если сумма больше 100 000 — поставить галочку «Требует согласования», иначе снять её.`,
    spec: specOf("hook", [], { amount: "Number", needs_approval: "Bool" }),
    intent: "BlockFixEntryPoint hat kept, THIS_PROCESS (ЭТА ИНСТАНЦИЯ), More on the VALUE read, write via the VALUE act with yes/no, closing FROM_METHOD" },
  { id: "46", cell: "M spec + copy, nested table",
    task: `БО «Заказ» (код Order) содержит вложенную таблицу «Позиции» (поле типа БО с видом «таблица», код items) — записи БО «Позиция заказа» с полями «Количество» (число, код qty) и «Цена» (число, код price).
Напиши тело метода order_total: вернуть сумму количество × цена по всем позициям заказа.
Копия пустого метода из IDE:
${hat("order_total", [P.order], T.Number)}`,
    spec: specOf("method", [P.order], { items: "Any", qty: "Number", price: "Number" }),
    intent: "foreach over order.items.#Значение, two hops on the loop element, Mul, accumulator Plus, one FROM_METHOD" },
  { id: "47", cell: "M terse + copy",
    task: `Метод делает из ФИО строку «Фамилия И. О.».
Копия пустого метода из IDE:
${hat("short_fio", [P.last, P.first, P.middle], T.Text)}`,
    spec: specOf("method", [P.last, P.first, P.middle]),
    intent: "rule 4 for all three text params, #Подстрока(0,1) guarded by #Пусто? (no middle name → no «О.»), Concat with more" },
  { id: "48", cell: "M spec + copy, dictionary",
    task: `На стенде есть справочник «Города» (код БО City): у каждой строки системные поля code (текст) и label (название, многоязычное).
Напиши тело метода city_name: по коду города вернуть его название по-русски; если такого кода нет — вернуть пустую строку.
Копия пустого метода из IDE:
${hat("city_name", [P.code], T.Text)}`,
    spec: specOf("method", [P.code], { code: "Text", label: "TextLang" }),
    intent: "findByFilter on a City BoRefCode (filter or none), foreach, code Eq text, label → VALUE → RUS, break, one FROM_METHOD" },
  { id: "49", cell: "C spec, process",
    task: `Бизнес-процесс «Согласование закупки» (БО-процесс, код Purchase, поле «Сумма» — число, код amount). После шага «Заявка» стоит скрипт с двумя исходящими стрелками: к шагу «Директор» (id стрелки ${ARROW_DIR}) и к шагу «Руководитель» (id стрелки ${ARROW_HEAD}).
Напиши этот скрипт процесса: если сумма больше 500 000 — к директору, иначе к руководителю.`,
    spec: specOf("process", [], { amount: "Number" }, { arrows: [ARROW_DIR, ARROW_HEAD] }),
    intent: "BlockFixEntryPoint root, THIS_PROCESS amount VALUE, More, two FROM_METHOD_BY_ARROW with the GIVEN arrow ids" },
  { id: "50", cell: "C spec + copy, a call",
    task: `БО «Заказ» (код Order): поля «Номер» (текст, код number) и «Итого» (число, код total).
В проекте уже есть метод format_money(amount: Число): Текст — форматирует сумму. Его копия из IDE:
${hat("format_money", [P.amount], T.Text)}
Напиши тело метода describe_order: вернуть строку «Заказ №<номер>: <итого, отформатированное format_money>».
Копия пустого метода describe_order из IDE:
${hat("describe_order", [P.order2], T.Text)}`,
    spec: specOf("method", [P.order2], { number: "Text", total: "Number" }, { callees: { format_money: [P.amount[0]] } }),
    intent: "ExprCall funcName format_money, args keyed by the callee's param id aUvR@W6CAeWXHxFC, two hops on order, Concat, one FROM_METHOD" },
  { id: "51", cell: "C spec, field hook + date",
    task: `БО «Заявка» (код Request): поле «Статус» — выпадающий список (единичный выбор, код status) с вариантами кодов NEW, IN_WORK, DONE; поле «Дата закрытия» — дата, код closed_at.
Нужен скрипт на изменение поля «Статус»: когда статус становится DONE, проставить в «Дата закрытия» сегодняшнюю дату; при любом другом статусе очистить «Дата закрытия».`,
    spec: specOf("hook", [], { status: "SingleSelect", closed_at: "Date" }),
    intent: "SingleSelectRefCode const (Request/status/DONE) compared with the VALUE, today's date from §12a, clearing the date, entry point + FROM_METHOD" },
  { id: "52", cell: "C terse + copy, algorithm",
    task: `Проверка ИИН Республики Казахстан по контрольной сумме (12-й разряд). Вернуть Да, если ИИН корректен.
Копия пустого метода из IDE:
${hat("is_iin_checksum_ok", [P.iin2], T.Bool)}`,
    spec: specOf("method", [P.iin2]),
    intent: "12-digit guard, weights 1..11 then 3..11,1,2, mod 11 via #Взять целую часть (no Eq on numbers), modules by 0S.2a, one FROM_METHOD" },
  { id: "53", cell: "M spec, process Script figure",
    task: `Бизнес-процесс «Заявка на ремонт» (БО-процесс, код Repair_request, поле «Комментарий» — текст, код comment). После шага «Заявка» стоит фигура «Скрипт» с одной исходящей стрелкой к шагу «Проверка» (id стрелки ${ARROW_ONE}).
Напиши этот скрипт: записать в «Комментарий» текст «Принято в работу».`,
    spec: specOf("process", [], { comment: "Text" }, { arrows: [ARROW_ONE] }),
    intent: "BlockFixEntryPoint root, THIS_PROCESS comment VALUE = text, ends in a plain FROM_METHOD (a Script figure), no exit by arrow" },
];

const WRAP = (task: string, dir: string) => `Ты пишешь скрипт для Block IDE low-code платформы MyBPM.
ЕДИНСТВЕННЫЙ источник знаний о формате: /home/dmezhnov/programming/MyBPM/MYBPM-IMPORTS.md
(Часть II, §0S COOKBOOK — самодостаточная инструкция; остальные разделы читай, если нужно). Документ большой — читай частями.
ЗАПРЕЩЕНО использовать или читать что-либо из /home/dmezhnov/programming/MyBPM/tools/ и других папок, кроме этого документа и ${dir}.
ЗАПРЕЩЕНО класть что-либо в буфер обмена (никаких wl-copy) и обращаться к стенду — результат только файлом.
ЗАДАЧА: ${task}
Спросить пользователя ты НЕ можешь. Если документ требует данных от пользователя — поступи так, как документ
предписывает для случая «пользователь отказался их дать».
РЕЗУЛЬТАТ: ${dir}/script.json — файл скрипта ровно в том виде, в каком ты бы его отдал (для буфера обмена или, если документ велит доставлять иначе, для того пути — тогда в notes.md назови путь; если ты решил, что скрипт выдать нельзя, не создавай его),
и ${dir}/notes.md: ПЕРВЫМ пунктом — какие разделы и диапазоны строк документа ты прочитал; затем решения, допущения, что
неоднозначно, что ты бы спросил у пользователя и куда ему вставлять.`;

const want = list?.split(",").map((s) => s.trim());
for (const c of cases.filter((c) => !want || want.includes(c.id))) {
  const dir = `${run}/case${c.id}`;
  await Bun.write(`${dir}/prompt.txt`, WRAP(c.task, dir));
  await Bun.write(`${dir}/spec.json`, JSON.stringify(c.spec, null, 1));
  await Bun.write(`${dir}/intent.txt`, `${c.cell}\n${c.intent}\n`);
  console.log(dir);
}
