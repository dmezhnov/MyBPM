# Cookbook eval — 12 generic tasks for a context-free model

Purpose: prove §0 of `MYBPM-IMPORTS.md` is self-sufficient. Each case is run by ONE fresh subagent
(model `haiku`, `subagent_type: general-purpose`), no other context, and its archive is graded by
`tools/validate-archive.bun.ts`.

Prompt wrapper (same for every case, RU):

> Ты собираешь конфигурационный архив для low-code платформы MyBPM.
> ЕДИНСТВЕННЫЙ источник знаний о формате: /home/dmezhnov/programming/MyBPM/MYBPM-IMPORTS.md
> (Часть I, §0 COOKBOOK — самодостаточная инструкция; остальные разделы читай, если нужно).
> ЗАПРЕЩЕНО использовать или читать генераторы из /home/dmezhnov/programming/MyBPM/tools/.
> ЗАДАЧА: <case>
> Спросить пользователя ты НЕ можешь. Если документ требует данных со стенда — поступи так, как
> документ предписывает для случая «пользователь отказался их дать».
> РЕЗУЛЬТАТ: <dir>/archive.mybpm.zip и <dir>/notes.md (решения, что деградировал, что неоднозначно).

| # | case | what it probes |
|---|---|---|
| 01 | CRM школы: «Класс» + «Ученик», ученик ссылается на класс | 2 BO in one archive, BO-ref without a stand id (§0.2a degrade) |
| 02 | Todo-лист: «Задача», приоритет — список вручную | FROM_FIELD dropdown, isRequired |
| 03 | Обращения граждан — БИЗНЕС-ПРОЦЕСС, схема начало→рассмотрение→конец | BO_PROCESS, 3rd line, PROCESS_STATUS |
| 04 | Справочник «Города Казахстана» + регион и население | BO_DICTIONARY, extra fields |
| 05 | Анкета кандидата HR | TAB_GROUP, PROGRESS_BAR, QUESTIONNAIRE, FILE_UPLOAD multiple, STATIC_TEXT |
| 06 | Панель «Рабочий стол менеджера» с реестрами | BO_PANEL, registry widgets without stand ids |
| 07 | Составной объект «Все контакты» из Клиенты+Поставщики | BO_COMPOSITE, bos[], boFieldCodes |
| 08 | Учёт оборудования | isUnique+isRequired, nativeFields, BUTTON + CURRENT_USER widgets |
| 09 | Бронирование переговорных | PERIOD_TIME, TIME, DATE, GEO_POINT, LINK, EMAIL, PHONE, TEXTAREA |
| 10 | Мультиязычный каталог товаров | INPUT_TEXT_LANG, TEXTAREA_LANG, YEAR, YEAR_AND_MONTH, CHECKLIST gap, FILE_UPLOAD camera |
| 11 | Библиотека: справочник «Жанр» + «Книга» | DROPDOWN_SINGLE FROM_BO by code, Person reference |
| 12 | Реестр договоров | SIGNATURE, IFRAME, CAPTCHA, CURRENT_DATE widgets, FILE_UPLOAD single |

Not covered yet (next rounds): Part II Block IDE scripts (§0S) and Part III record xlsx (§0X).

## Rounds

- **Round 1** (2026-09-18) — all 12 cases against the original §0. Snapshot `tools/out/eval-2026-09-18/`.
- **Round 2** — all 12 against the eight §0 repairs. Snapshot `tools/out/eval2-2026-09-18/`.
- **Round 3** — cases 03/05/06/07/11 against the four round-2 repairs. Snapshot `tools/out/eval3-2026-09-18/`.
- **Round 4** — cases 05/07/11 against the three round-3 repairs (composite never degrades to a plain BO,
  `dictionaryFields` on every BO, the `STATIC_TEXT` heading rule promoted to 0.10/0.11).
  Snapshot `tools/out/eval4-2026-09-18/`.

Grade a run directory with `bun tools/grade-eval.bun.ts <runDir> [snapshotDir] [05,07,11]`. Read the
archives by hand as well: the validator checks
FORMAT, not INTENT, and every round so far has had at least one case that scored clean while building
the wrong kind of object.
