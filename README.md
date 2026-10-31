# Leaf — читать и понимать

Читалка английских книг с переводом на русский, словарём и разбором грамматики.

- **Сайт:** https://kutlugildinartem-dotcom.github.io/EBOOK/
- **Инструкция по самостоятельной работе:** [START_HERE_RU.md](START_HERE_RU.md)
- **Сборки и публикации:** https://github.com/kutlugildinartem-dotcom/EBOOK/actions

## Что можно делать

Загружать EPUB, PDF с текстовым слоем, DOCX и TXT; менять обложку; читать с телефона и компьютера; переводить всю страницу по кнопке справа сверху; выделять слова, предложения и абзацы; открывать словарь и грамматические пояснения; менять тему, шрифт и размер текста.

Книги и позиция чтения сохраняются в браузере устройства. Синхронизации между устройствами нет. При переходе со старого адреса ChatGPT Sites книги нужно добавить заново.

## Как выпускать изменения

1. Измените исходники в ветке `main` и отправьте commit/push.
2. GitHub Actions автоматически проверит и соберёт приложение.
3. После успешного задания `deploy` обновите страницу сайта на телефоне.

Держать ChatGPT открытым и просить ассистента о публикации не требуется. Публикация настроена в [.github/workflows/pages.yml](.github/workflows/pages.yml). Её также можно запустить вручную: Actions → Publish Leaf → Run workflow.

## Запуск на компьютере

Нужны Node.js 24, Python 3 с командой `python3` и Git.

```sh
git clone https://github.com/kutlugildinartem-dotcom/EBOOK.git
cd EBOOK
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm prepare:assets
pnpm dev
```

Для статического хостинга:

```sh
pnpm build:static
```

Готовый файл: `dist-static/index.html`. Статическая версия не требует серверного API или ключей. Первому запуску локальной модели нужен интернет для загрузки языкового пакета примерно на 100 МБ; сложная проза и идиомы могут переводиться с ошибками. Серверный режим Google в версии GitHub Pages отключён.

## Где что менять

| Файл | Назначение |
| --- | --- |
| `app/page.tsx` | Интерфейс и взаимодействия |
| `app/globals.css` | Оформление |
| `app/import-book.ts` | Импорт книг |
| `app/translation-service.ts` | Управление переводом и кэшем |
| `translation/worker.ts` | Локальная модель перевода |
| `scripts/build-static.mjs` | Статическая сборка |

## Проверки

```sh
pnpm prepare:assets
node tests/language-engine.test.mjs
node tests/translation-selection.test.mjs
pnpm build:static
```

Словарь воспроизводится из `public/dictionary/source.tar.xz`; языковой runtime и PDF-воркер копируются из npm-пакетов. Сгенерированные файлы исключены из Git. Исходный архив словаря и лицензии включены в репозиторий.

FreeDict/WikDict, Karl Bartel и участники Wiktionary через DBnary, CC BY-SA 3.0. Сведения и изменения: [app/DICTIONARY-LICENSE.md](app/DICTIONARY-LICENSE.md), [public/dictionary/metadata.json](public/dictionary/metadata.json). Transformers.js и OPUS-MT: Apache-2.0; ONNX Runtime: MIT.
