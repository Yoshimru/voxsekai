from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable, Sequence

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent
OUTPUT_DIR = ROOT / "reports"
OUTPUT_DIR.mkdir(exist_ok=True)

FONT_NAME = "Times New Roman"
FONT_SIZE = 13
TABLE_FONT_SIZE = 11

CITATION_PATTERN = re.compile(
    r"[ \t]*\[\s*\d+(?:\s*[,;–—-]\s*\d+)*\s*\]"
)


def normalize_document_text(text: str) -> str:
    """Remove numeric citations and use short dashes in generated documents."""
    normalized = CITATION_PATTERN.sub("", str(text)).replace("—", "–")
    return re.sub(r"[ \t]{2,}", " ", normalized)

HOME_SCREENSHOT = Path(
    r"C:\Users\Yoshimru\AppData\Local\Temp\opencode\voxsekai-home.png"
)
CATALOG_SCREENSHOT = Path(
    r"C:\Users\Yoshimru\AppData\Local\Temp\opencode\voxsekai-catalog.png"
)
ADMIN_SCREENSHOT = Path(
    r"C:\Users\Yoshimru\AppData\Local\Temp\opencode\voxsekai-admin-login.png"
)
SITE_MAP = SOURCE_ROOT / "Карта.png"
ER_DIAGRAM = SOURCE_ROOT / "er.png"


TEST_CASES = [
    {
        "id": "TC-01",
        "name": "Открытие главной страницы",
        "module": "Публичная часть",
        "type": "Позитивный",
        "precondition": "Сервер запущен, тестовая база данных инициализирована.",
        "steps": [
            "Отправить GET-запрос на маршрут /.",
            "Проверить HTTP-статус ответа.",
            "Проверить наличие названия VoxSekai в HTML.",
        ],
        "expected": "Сервер возвращает статус 200, HTML содержит название VoxSekai.",
        "actual": "Получен статус 200, название VoxSekai найдено в HTML.",
    },
    {
        "id": "TC-02",
        "name": "Отображение трека в каталоге",
        "module": "Каталог",
        "type": "Позитивный",
        "precondition": "В тестовой SQLite-базе создан трек «Отчётный трек».",
        "steps": [
            "Отправить GET-запрос на маршрут /catalog.",
            "Проверить заголовок страницы.",
            "Проверить наличие тестового трека в HTML.",
        ],
        "expected": "Статус 200; страница содержит заголовок «Каталог музыки» и тестовый трек.",
        "actual": "Каталог открыт со статусом 200, заголовок и тестовый трек присутствуют.",
    },
    {
        "id": "TC-03",
        "name": "Открытие страницы существующего трека",
        "module": "Карточка трека",
        "type": "Позитивный",
        "precondition": "В базе есть трек с идентификатором report-track.",
        "steps": [
            "Отправить GET-запрос на /track/report-track.",
            "Проверить статус ответа.",
            "Проверить название трека и имя исполнителя.",
        ],
        "expected": "Статус 200; страница содержит «Отчётный трек» и «Тестовый исполнитель».",
        "actual": "Получен статус 200, оба значения отображаются на странице.",
    },
    {
        "id": "TC-04",
        "name": "Обработка неизвестного адреса",
        "module": "Обработка ошибок",
        "type": "Негативный",
        "precondition": "Сервер запущен.",
        "steps": [
            "Отправить GET-запрос на /route-that-does-not-exist.",
            "Проверить HTTP-статус.",
            "Проверить текст страницы ошибки.",
        ],
        "expected": "Сервер возвращает статус 404 и страницу «Страница не найдена».",
        "actual": "Получен статус 404, корректная страница ошибки отображена.",
    },
    {
        "id": "TC-05",
        "name": "Защита страницы профиля от гостя",
        "module": "Авторизация",
        "type": "Негативный",
        "precondition": "Запрос выполняется без пользовательской сессии.",
        "steps": [
            "Отправить GET-запрос на /profile без cookie.",
            "Проверить статус и заголовок Location.",
        ],
        "expected": "Статус 302; перенаправление на /login?next=%2Fprofile.",
        "actual": "Получено ожидаемое перенаправление со статусом 302.",
    },
    {
        "id": "TC-06",
        "name": "Регистрация нового пользователя",
        "module": "Регистрация",
        "type": "Позитивный",
        "precondition": "Пользователь report_user отсутствует в базе.",
        "steps": [
            "Отправить POST-запрос на /register с корректными именем, e-mail и паролем.",
            "Проверить перенаправление на профиль и выдачу cookie connect.sid.",
            "Проверить запись пользователя в SQLite.",
        ],
        "expected": "Статус 302; переход на /profile; создана сессия; пользователь сохранён.",
        "actual": "Все условия выполнены, в таблице users создана одна запись.",
    },
    {
        "id": "TC-07",
        "name": "Запрет повторного имени пользователя",
        "module": "Регистрация",
        "type": "Негативный",
        "precondition": "Пользователь report_user уже зарегистрирован.",
        "steps": [
            "Повторно отправить POST-запрос на /register с именем report_user.",
            "Проверить статус и сообщение об ошибке.",
        ],
        "expected": "Статус 400; сообщение о существующем имени пользователя.",
        "actual": "Регистрация отклонена со статусом 400 и ожидаемым сообщением.",
    },
    {
        "id": "TC-08",
        "name": "Выход пользователя из аккаунта",
        "module": "Авторизация",
        "type": "Позитивный",
        "precondition": "Пользователь авторизован, имеется cookie сессии.",
        "steps": [
            "Отправить POST-запрос на /logout с cookie пользователя.",
            "Проверить перенаправление и очистку cookie.",
        ],
        "expected": "Статус 302; переход на /; cookie connect.sid очищена.",
        "actual": "Выполнено перенаправление, сервер отправил очищающую cookie.",
    },
    {
        "id": "TC-09",
        "name": "Вход с неверным паролем",
        "module": "Авторизация",
        "type": "Негативный",
        "precondition": "Пользователь report_user зарегистрирован.",
        "steps": [
            "Отправить POST-запрос на /login с корректным e-mail и неверным паролем.",
            "Проверить статус и текст сообщения.",
        ],
        "expected": "Статус 400; сообщение «Неверный логин или пароль».",
        "actual": "Доступ не предоставлен, получен статус 400 и ожидаемое сообщение.",
    },
    {
        "id": "TC-10",
        "name": "Вход пользователя по e-mail",
        "module": "Авторизация",
        "type": "Позитивный",
        "precondition": "Пользователь report_user зарегистрирован и вышел из аккаунта.",
        "steps": [
            "Отправить POST-запрос на /login с e-mail и правильным паролем.",
            "Проверить перенаправление и новую cookie сессии.",
        ],
        "expected": "Статус 302; переход на /; выдана cookie connect.sid.",
        "actual": "Пользователь успешно вошёл по e-mail, сессия создана.",
    },
    {
        "id": "TC-11",
        "name": "Открытие профиля авторизованным пользователем",
        "module": "Профиль",
        "type": "Позитивный",
        "precondition": "Имеется действующая сессия пользователя report_user.",
        "steps": [
            "Отправить GET-запрос на /profile с cookie пользователя.",
            "Проверить статус и отображаемое имя.",
        ],
        "expected": "Статус 200; HTML содержит имя report_user.",
        "actual": "Профиль открыт со статусом 200, имя пользователя отображается.",
    },
    {
        "id": "TC-12",
        "name": "Запрет оценки трека гостем",
        "module": "Оценки",
        "type": "Негативный",
        "precondition": "Тестовый трек существует, пользователь не авторизован.",
        "steps": [
            "Отправить POST-запрос на /track/report-track/rate со значением 5 без cookie.",
            "Проверить перенаправление.",
        ],
        "expected": "Статус 302; переход на вход с возвратом к странице трека.",
        "actual": "Получен переход на /login?next=%2Ftrack%2Freport-track.",
    },
    {
        "id": "TC-13",
        "name": "Сохранение оценки авторизованного пользователя",
        "module": "Оценки",
        "type": "Позитивный",
        "precondition": "Пользователь авторизован, тестовый трек существует.",
        "steps": [
            "Отправить POST-запрос на /track/report-track/rate со значением 5 и cookie.",
            "Проверить перенаправление.",
            "Прочитать оценку из таблицы track_ratings.",
        ],
        "expected": "Переход на страницу трека; в базе сохранена оценка 5.",
        "actual": "Перенаправление выполнено, значение 5 найдено в SQLite.",
    },
    {
        "id": "TC-14",
        "name": "Запрет входа обычного пользователя в админ-панель",
        "module": "Разграничение доступа",
        "type": "Негативный",
        "precondition": "Пользователь report_user имеет роль user.",
        "steps": [
            "Отправить POST-запрос на /admin/login с правильными данными пользователя.",
            "Проверить ответ и сообщение об отсутствии прав.",
        ],
        "expected": "Административная сессия не создаётся, отображается сообщение об отсутствии прав.",
        "actual": "Показано сообщение «Этому аккаунту нельзя входить в админпанель».",
    },
    {
        "id": "TC-15",
        "name": "Вход администратора и открытие дашборда",
        "module": "Админ-панель",
        "type": "Позитивный",
        "precondition": "В тестовой базе автоматически создан администратор.",
        "steps": [
            "Отправить POST-запрос на /admin/login с корректными данными администратора.",
            "Проверить перенаправление и cookie сессии.",
            "Отправить GET-запрос на /admin с полученной cookie.",
            "Проверить основные разделы дашборда.",
        ],
        "expected": "Вход ведёт на /admin; дашборд отвечает со статусом 200 и содержит разделы управления.",
        "actual": "Администратор вошёл; разделы «Треки» и «Пользователи» доступны.",
    },
]


def set_cell_margins(cell, top=80, start=100, bottom=80, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def set_run_font(run, size=FONT_SIZE, bold=None, italic=None):
    run.font.name = FONT_NAME
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor(0, 0, 0)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.rFonts
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.insert(0, r_fonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        r_fonts.set(qn(f"w:{attr}"), FONT_NAME)


def format_paragraph(
    paragraph,
    *,
    alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
    first_indent=True,
    line_spacing=1.5,
    keep_with_next=False,
):
    paragraph.alignment = alignment
    pf = paragraph.paragraph_format
    pf.left_indent = Cm(0)
    pf.right_indent = Cm(0)
    pf.first_line_indent = Cm(1.25) if first_indent else Cm(0)
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.line_spacing = line_spacing
    pf.keep_with_next = keep_with_next
    for run in paragraph.runs:
        set_run_font(run)
    return paragraph


def configure_section(section):
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(1.0)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(2.0)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(1.0)


def configure_document(document: Document):
    for section in document.sections:
        configure_section(section)

    normal = document.styles["Normal"]
    normal.font.name = FONT_NAME
    normal.font.size = Pt(FONT_SIZE)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.first_line_indent = Cm(1.25)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)

    for style_name in ("Heading 1", "Heading 2", "Heading 3"):
        style = document.styles[style_name]
        style.font.name = FONT_NAME
        style.font.size = Pt(FONT_SIZE)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
        style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        style.paragraph_format.first_line_indent = Cm(1.25)
        style.paragraph_format.left_indent = Cm(0)
        style.paragraph_format.line_spacing = 1.5
        style.paragraph_format.space_before = Pt(0)
        style.paragraph_format.space_after = Pt(0)
        style.paragraph_format.keep_with_next = True

    if "Caption Custom" not in [style.name for style in document.styles]:
        caption = document.styles.add_style("Caption Custom", WD_STYLE_TYPE.PARAGRAPH)
    else:
        caption = document.styles["Caption Custom"]
    caption.font.name = FONT_NAME
    caption.font.size = Pt(12)
    caption.font.color.rgb = RGBColor(0, 0, 0)
    caption._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_NAME)
    caption.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption.paragraph_format.first_line_indent = Cm(0)
    caption.paragraph_format.line_spacing = 1.0
    caption.paragraph_format.space_before = Pt(0)
    caption.paragraph_format.space_after = Pt(0)

    settings = document.settings._element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings.append(update_fields)


def add_field(paragraph, instruction: str, placeholder=""):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = placeholder
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for node in (begin, instr, separate, text, end):
        run._r.append(node)
    set_run_font(run)
    return run


def add_page_number(section, start=1):
    section.footer.is_linked_to_previous = False
    footer = section.footer
    paragraph = footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.first_line_indent = Cm(0)
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    add_field(paragraph, "PAGE", str(start))
    sect_pr = section._sectPr
    pg_num_type = sect_pr.find(qn("w:pgNumType"))
    if pg_num_type is None:
        pg_num_type = OxmlElement("w:pgNumType")
        sect_pr.append(pg_num_type)
    pg_num_type.set(qn("w:start"), str(start))


def clear_footer(section):
    section.footer.is_linked_to_previous = False
    for paragraph in section.footer.paragraphs:
        paragraph.clear()


def add_blank(document, count=1):
    for _ in range(count):
        paragraph = document.add_paragraph()
        format_paragraph(paragraph, first_indent=False)


def add_centered(document, text, *, bold=False, size=FONT_SIZE, spacing=1.5):
    paragraph = document.add_paragraph()
    format_paragraph(
        paragraph,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        first_indent=False,
        line_spacing=spacing,
    )
    run = paragraph.add_run(normalize_document_text(text))
    set_run_font(run, size=size, bold=bold)
    return paragraph


def add_title_page(document: Document, document_title: str, subtitle: str):
    add_centered(document, "[НАИМЕНОВАНИЕ ОБРАЗОВАТЕЛЬНОЙ ОРГАНИЗАЦИИ]", bold=True)
    add_centered(document, "[ОТДЕЛЕНИЕ / КАФЕДРА]", bold=True)
    add_blank(document, 5)
    add_centered(document, document_title.upper(), bold=True)
    add_centered(document, subtitle, bold=True)
    add_centered(document, "Команда 2 «Атмосфера»", bold=True)
    add_blank(document, 5)

    details = document.add_table(rows=4, cols=2)
    details.alignment = WD_TABLE_ALIGNMENT.RIGHT
    details.autofit = False
    details.columns[0].width = Cm(3.4)
    details.columns[1].width = Cm(7.5)
    values = [
        ("Выполнили:", "Шагираев Ислам\nШишов Евгений"),
        ("Группа:", "210b-6k"),
        ("Руководитель:", "[Ф.И.О. руководителя]"),
        ("Дата:", "9 ноября 2026 года"),
    ]
    for row, (label, value) in zip(details.rows, values):
        row.cells[0].text = label
        row.cells[1].text = value
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            set_cell_margins(cell, 0, 0, 0, 0)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_borders = OxmlElement("w:tcBorders")
            for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
                node = OxmlElement(f"w:{edge}")
                node.set(qn("w:val"), "nil")
                tc_borders.append(node)
            tc_pr.append(tc_borders)
            for paragraph in cell.paragraphs:
                format_paragraph(paragraph, first_indent=False, alignment=WD_ALIGN_PARAGRAPH.LEFT)
    add_blank(document, 4)
    add_centered(document, "[ГОРОД]", bold=False)
    add_centered(document, "2026", bold=False)


def add_new_section(document: Document, page_number=None):
    section = document.add_section(WD_SECTION.NEW_PAGE)
    configure_section(section)
    clear_footer(section)
    if page_number is not None:
        add_page_number(section, page_number)
    return section


def add_structural_heading(document: Document, title: str, include_in_toc=True):
    paragraph = document.add_paragraph(style="Heading 1" if include_in_toc else "Normal")
    format_paragraph(
        paragraph,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        first_indent=False,
        keep_with_next=True,
    )
    run = paragraph.add_run(normalize_document_text(title.upper()))
    set_run_font(run, bold=True)
    return paragraph


def add_heading(document: Document, text: str, level=1, new_page=False):
    if new_page:
        document.add_page_break()
    paragraph = document.add_paragraph(style=f"Heading {min(level, 3)}")
    format_paragraph(paragraph, first_indent=True, keep_with_next=True)
    run = paragraph.add_run(normalize_document_text(text))
    set_run_font(run, bold=True)
    document.add_paragraph().paragraph_format.space_after = Pt(0)
    return paragraph


def add_body(document: Document, text: str, *, first_indent=True, alignment=WD_ALIGN_PARAGRAPH.JUSTIFY):
    paragraph = document.add_paragraph()
    run = paragraph.add_run(normalize_document_text(text))
    set_run_font(run)
    format_paragraph(paragraph, first_indent=first_indent, alignment=alignment)
    return paragraph


def add_bullets(document: Document, items: Iterable[str]):
    for item in items:
        paragraph = document.add_paragraph()
        format_paragraph(paragraph, first_indent=False)
        paragraph.paragraph_format.left_indent = Cm(1.25)
        run = paragraph.add_run(normalize_document_text(f"– {item}"))
        set_run_font(run)


def set_cell_text(cell, text, *, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, size=TABLE_FONT_SIZE):
    cell.text = ""
    paragraph = cell.paragraphs[0]
    paragraph.alignment = align
    paragraph.paragraph_format.first_line_indent = Cm(0)
    paragraph.paragraph_format.left_indent = Cm(0)
    paragraph.paragraph_format.right_indent = Cm(0)
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.0
    run = paragraph.add_run(normalize_document_text(str(text)))
    set_run_font(run, size=size, bold=bold)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def add_table(
    document: Document,
    headers: Sequence[str],
    rows: Sequence[Sequence[str]],
    *,
    widths: Sequence[float] | None = None,
    font_size=TABLE_FONT_SIZE,
):
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for index, header in enumerate(headers):
        set_cell_text(
            table.rows[0].cells[index],
            header,
            bold=True,
            align=WD_ALIGN_PARAGRAPH.CENTER,
            size=font_size,
        )
        if widths:
            table.rows[0].cells[index].width = Cm(widths[index])
    set_repeat_table_header(table.rows[0])
    prevent_row_split(table.rows[0])
    for values in rows:
        row = table.add_row()
        prevent_row_split(row)
        for index, value in enumerate(values):
            set_cell_text(row.cells[index], value, size=font_size)
            if widths:
                row.cells[index].width = Cm(widths[index])
    return table


def add_table_caption(document: Document, number: int, title: str):
    paragraph = document.add_paragraph()
    format_paragraph(paragraph, first_indent=False, alignment=WD_ALIGN_PARAGRAPH.LEFT, line_spacing=1.0)
    run = paragraph.add_run(normalize_document_text(f"Таблица {number} – {title}"))
    set_run_font(run, size=12)
    return paragraph


def add_picture(document: Document, path: Path, number: int, caption: str, width_cm=16.5):
    paragraph = document.add_paragraph()
    format_paragraph(paragraph, alignment=WD_ALIGN_PARAGRAPH.CENTER, first_indent=False, line_spacing=1.0)
    run = paragraph.add_run()
    run.add_picture(str(path), width=Cm(width_cm))
    caption_paragraph = document.add_paragraph(style="Caption Custom")
    caption_run = caption_paragraph.add_run(
        normalize_document_text(f"Рисунок {number} – {caption}")
    )
    set_run_font(caption_run, size=12)
    return caption_paragraph


def add_toc(document: Document):
    add_structural_heading(document, "СОДЕРЖАНИЕ", include_in_toc=False)
    paragraph = document.add_paragraph()
    format_paragraph(paragraph, first_indent=False, alignment=WD_ALIGN_PARAGRAPH.LEFT)
    add_field(paragraph, 'TOC \\o "1-3" \\h \\z \\u', "Содержание будет обновлено в Microsoft Word")


def add_assignment_page(
    document: Document,
    title: str,
    tasks: Sequence[str],
    objective: str | None = None,
):
    add_structural_heading(document, "ЗАДАНИЕ", include_in_toc=False)
    add_body(document, f"Тема работы: {title}")
    add_body(document, f"Цель работы: {objective or 'разработать и документировать музыкальный веб-сервис VoxSekai, обеспечивающий работу с каталогом, учётными записями, оценками, плейлистами, подборками и событиями.'}")
    add_body(document, "Для достижения цели необходимо решить следующие задачи:")
    add_bullets(document, tasks)
    add_blank(document, 2)
    add_body(document, "Исходные материалы: бриф, требования проекта, анализ аналогов, user stories, карта сайта, ER-диаграмма, макет Figma, исходный код и результаты тестирования.")


def add_abstract_page(
    document: Document,
    document_kind: str,
    figures: int,
    tables: int,
    sources: int,
    *,
    subject_text: str | None = None,
    summary_text: str | None = None,
    keywords: str | None = None,
):
    add_structural_heading(document, "РЕФЕРАТ", include_in_toc=False)
    paragraph = document.add_paragraph()
    format_paragraph(paragraph)
    run = paragraph.add_run(
        normalize_document_text(f"{document_kind}. Объём документа — ")
    )
    set_run_font(run)
    add_field(paragraph, "NUMPAGES", "00")
    run = paragraph.add_run(
        normalize_document_text(
            f" с.; рисунков — {figures}; таблиц — {tables}"
            + (f"; использованных источников — {sources}." if sources else ".")
        )
    )
    set_run_font(run)
    add_body(
        document,
        subject_text
        or "Объект разработки — музыкальный веб-сервис VoxSekai. Сервис предназначен для просмотра музыкального каталога, воспроизведения треков, работы с исполнителями, подборками, событиями, плейлистами, избранным и пользовательскими оценками.",
    )
    add_body(
        document,
        summary_text
        or "В работе описаны требования, информационная архитектура, структура базы данных, программная реализация, разграничение доступа и результаты интеграционного тестирования.",
    )
    add_body(
        document,
        keywords
        or "Ключевые слова: VOXSEKAI, МУЗЫКАЛЬНЫЙ СЕРВИС, NODE.JS, EXPRESS, EJS, SQLITE, АВТОРИЗАЦИЯ, АДМИН-ПАНЕЛЬ, ИНТЕГРАЦИОННОЕ ТЕСТИРОВАНИЕ.",
    )


def add_test_case_table(document: Document, case: dict, table_number: int):
    document.add_page_break()
    add_heading(document, f"2.{table_number} {case['id']}. {case['name']}", level=2)
    add_table_caption(document, table_number + 2, f"Тест-кейс {case['id']}")
    steps = "\n".join(f"{index}. {step}" for index, step in enumerate(case["steps"], 1))
    rows = [
        ("Идентификатор", case["id"]),
        ("Название", case["name"]),
        ("Модуль", case["module"]),
        ("Тип проверки", case["type"]),
        ("Предусловие", case["precondition"]),
        ("Шаги", steps),
        ("Ожидаемый результат", case["expected"]),
        ("Фактический результат", case["actual"]),
        ("Статус", "ПРОЙДЕН"),
    ]
    table = add_table(document, ["Поле", "Описание"], rows, widths=[4.2, 13.3], font_size=11)
    for row in table.rows[1:]:
        set_cell_text(row.cells[0], row.cells[0].text, bold=True, size=11)
    set_cell_text(table.rows[-1].cells[1], "ПРОЙДЕН", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=11)


def build_test_report():
    document = Document()
    configure_document(document)
    add_title_page(
        document,
        "Отчёт о функциональном тестировании",
        "музыкального веб-сервиса «VoxSekai»",
    )
    clear_footer(document.sections[0])

    add_new_section(document)
    add_assignment_page(
        document,
        "Функциональное тестирование музыкального веб-сервиса VoxSekai",
        [
            "подготовить не менее 15 позитивных и негативных тест-кейсов;",
            "проверить публичные страницы, регистрацию, авторизацию и разграничение доступа;",
            "проверить сохранение пользовательской оценки в SQLite;",
            "выполнить тесты на изолированной временной базе данных;",
            "зафиксировать фактические результаты и итоговый статус каждой проверки.",
        ],
        objective="подготовить и провести функциональное тестирование основных серверных сценариев VoxSekai, зафиксировать ожидаемые и фактические результаты.",
    )

    add_new_section(document)
    add_abstract_page(
        document,
        "Отчёт о тестировании",
        figures=0,
        tables=18,
        sources=0,
        subject_text="Объект тестирования — музыкальный веб-сервис VoxSekai. Проверяются публичные маршруты, регистрация, авторизация, разграничение доступа, пользовательские оценки и административная панель.",
        summary_text="В документе приведены условия тестирования, 15 позитивных и негативных тест-кейсов, фактические результаты и итоговая статистика автоматизированного прогона.",
        keywords="Ключевые слова: VOXSEKAI, ТЕСТ-КЕЙС, ФУНКЦИОНАЛЬНОЕ ТЕСТИРОВАНИЕ, ИНТЕГРАЦИОННОЕ ТЕСТИРОВАНИЕ, NODE.TEST, SQLITE, АВТОРИЗАЦИЯ, РАЗГРАНИЧЕНИЕ ДОСТУПА.",
    )

    add_new_section(document, page_number=4)
    add_toc(document)

    document.add_page_break()
    add_structural_heading(document, "ВВЕДЕНИЕ")
    add_body(
        document,
        "Цель тестирования — подтвердить работоспособность основных серверных сценариев VoxSekai и корректность взаимодействия HTTP-маршрутов с SQLite. Проверка выполнена автоматизированным интеграционным набором на базе встроенного модуля node:test.",
    )
    add_body(
        document,
        "Особое внимание уделено негативным сценариям: обращению к неизвестному адресу, попытке открыть защищённую страницу без сессии, повторной регистрации, неверному паролю, оценке трека гостем и попытке обычного пользователя войти в административную часть.",
    )

    add_heading(document, "1 МЕТОДИКА И УСЛОВИЯ ТЕСТИРОВАНИЯ", new_page=True)
    add_heading(document, "1.1 Тестовая среда", level=2)
    add_table_caption(document, 1, "Параметры тестовой среды")
    add_table(
        document,
        ["Параметр", "Значение"],
        [
            ("Дата и время прогона", "9 ноября 2026 года, 11:28 (UTC+4)"),
            ("Операционная система", "Windows"),
            ("Node.js", "24.11.1"),
            ("npm", "11.6.2"),
            ("Команда запуска", "npm run test:report"),
            ("HTTP-сервер", "Локальный сервер на случайном свободном порту"),
            ("База данных", "Временная изолированная SQLite-база"),
        ],
        widths=[5.0, 12.5],
    )
    add_body(
        document,
        "Перед прогоном тестовый набор создаёт отдельный файл базы данных, применяет рабочую схему и добавляет тестовые записи исполнителя и трека. После завершения HTTP-сервер останавливается, соединение с базой закрывается, временный каталог удаляется. Рабочая база проекта не изменяется.",
    )
    add_heading(document, "1.2 Критерии прохождения", level=2)
    add_bullets(
        document,
        [
            "фактический HTTP-статус совпадает с ожидаемым;",
            "заголовок перенаправления соответствует сценарию;",
            "в HTML присутствует ожидаемый текст;",
            "cookie сессии создаётся или очищается в требуемый момент;",
            "операция записи подтверждается прямым запросом к тестовой SQLite-базе;",
            "после прогона отсутствуют упавшие и пропущенные тесты.",
        ],
    )
    add_heading(document, "1.3 Состав набора", level=2)
    add_table_caption(document, 2, "Распределение тестов по типам")
    add_table(
        document,
        ["Категория", "Количество"],
        [("Позитивные", "9"), ("Негативные", "6"), ("Всего", "15")],
        widths=[12.0, 5.5],
    )

    add_heading(document, "2 ТЕСТ-КЕЙСЫ", new_page=True)
    add_body(
        document,
        "В разделе приведены 15 тест-кейсов. Для каждого указаны предусловия, последовательность действий, ожидаемый и фактический результаты. Все проверки выполнены 9 ноября 2026 года.",
    )
    for index, case in enumerate(TEST_CASES, 1):
        add_test_case_table(document, case, index)

    add_heading(document, "3 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ", new_page=True)
    add_table_caption(document, 18, "Итоговые показатели прогона")
    add_table(
        document,
        ["Показатель", "Значение"],
        [
            ("Всего тест-кейсов", "15"),
            ("Успешно", "15"),
            ("Неуспешно", "0"),
            ("Пропущено", "0"),
            ("Доля успешных проверок", "100 %"),
            ("Продолжительность", "573,54 мс"),
        ],
        widths=[12.0, 5.5],
    )
    add_body(
        document,
        "Все запланированные тест-кейсы завершились успешно. В проверенном объёме блокирующих и функциональных дефектов не обнаружено.",
    )
    add_body(
        document,
        "Набор покрывает серверные маршруты и операции SQLite. В него не входят визуальная проверка адаптивной верстки, воспроизведение реального аудиофайла, загрузка медиа, доступность интерфейса и сценарии хранения данных в localStorage. Эти области требуют отдельного браузерного и ручного тестирования.",
    )

    document.add_page_break()
    add_structural_heading(document, "ЗАКЛЮЧЕНИЕ")
    add_body(
        document,
        "В ходе работы подготовлены и проведены 15 интеграционных проверок музыкального веб-сервиса VoxSekai. Подтверждена работоспособность публичных маршрутов, регистрации, входа и выхода, защиты профиля, пользовательских оценок, ролевого ограничения административной части и обработки ошибки 404.",
    )
    add_body(
        document,
        "Итоговый результат — 15 успешно выполненных тестов из 15. Тестовый набор сохранён в проекте и может быть повторно запущен командой npm run test:report.",
    )

    path = OUTPUT_DIR / "Тест-кейсы VoxSekai.docx"
    document.save(path)
    return path


def add_user_stories_table(document: Document, number: int):
    rows = [
        ("US-01", "Как гость, я хочу зарегистрироваться и войти, чтобы сохранять пользовательские данные.", "Регистрация, вход, выход, профиль, понятные ошибки."),
        ("US-02", "Как пользователь, я хочу искать треки и исполнителей по названию и жанру.", "Поиск и фильтрация каталога, сообщение при пустом результате."),
        ("US-03", "Как пользователь, я хочу открыть карточку трека или исполнителя.", "Отображение метаданных и доступных действий."),
        ("US-04", "Как пользователь, я хочу создавать и редактировать плейлисты.", "Название обязательно; состав и публичность можно изменять."),
        ("US-05", "Как автор плейлиста, я хочу добавлять и удалять треки.", "Состав плейлиста изменяется и сохраняется."),
        ("US-06", "Как пользователь, я хочу добавлять треки в избранное и ставить оценки.", "Избранное переключается; оценка находится в диапазоне 1–5."),
        ("US-07", "Как пользователь, я хочу видеть подборки и рекомендации.", "Подборки доступны по жанрам и предпочтениям."),
        ("US-08", "Как пользователь или администратор, я хочу работать с музыкальными событиями.", "Есть список и карточка события; управление доступно администратору."),
    ]
    add_table_caption(document, number, "Пользовательские истории проекта")
    add_table(document, ["ID", "User story", "Критерии приёмки"], rows, widths=[1.7, 8.0, 7.8], font_size=10)


def build_project_report():
    document = Document()
    configure_document(document)
    add_title_page(
        document,
        "Отчёт по учебному проекту",
        "музыкальный веб-сервис «VoxSekai»",
    )
    clear_footer(document.sections[0])

    add_new_section(document)
    add_assignment_page(
        document,
        "Разработка музыкального веб-сервиса VoxSekai",
        [
            "изучить предметную область и определить целевую аудиторию;",
            "проанализировать существующие музыкальные сервисы;",
            "сформировать пользовательские истории и карту сайта;",
            "спроектировать структуру данных и интерфейс;",
            "реализовать серверное приложение, пользовательскую и административную части;",
            "организовать хранение данных и разграничение доступа;",
            "подготовить и выполнить не менее 15 тестов;",
            "оформить эксплуатационную и проектную документацию.",
        ],
    )

    add_new_section(document)
    add_abstract_page(document, "Отчёт по проекту", figures=5, tables=10, sources=25)

    add_new_section(document, page_number=4)
    add_toc(document)

    document.add_page_break()
    add_structural_heading(document, "ВВЕДЕНИЕ")
    add_body(
        document,
        "Цифровые музыкальные сервисы объединяют поиск контента, работу с персональной библиотекой и воспроизведение в едином интерфейсе. Учебный проект VoxSekai разработан как локальный музыкальный веб-сервис, демонстрирующий полный цикл проектирования: от брифа и пользовательских сценариев до серверной реализации, базы данных и тестирования [1–4].",
    )
    add_body(
        document,
        "Цель проекта — создать удобное веб-приложение для просмотра музыкального каталога, воспроизведения треков, работы с исполнителями, подборками, плейлистами, избранным, оценками и событиями. Оформление отчёта выполнено по правилам, приведённым в методических указаниях [5].",
    )
    add_body(
        document,
        "Объектом разработки является музыкальный веб-сервис. Предмет разработки — архитектура, интерфейс, серверные маршруты, модель хранения данных и средства проверки качества приложения.",
    )
    add_body(document, "Для достижения поставленной цели решены следующие задачи:")
    add_bullets(
        document,
        [
            "проанализированы предметная область, роли и аналоги;",
            "сформированы восемь пользовательских историй;",
            "подготовлены карта сайта и проектная ER-диаграмма;",
            "реализованы публичная часть и административная панель;",
            "подключена SQLite-база и автоматическое создание схемы;",
            "реализованы регистрация, вход, роли и оценки треков;",
            "создан набор из 15 интеграционных тестов;",
            "подготовлены README и отчётная документация.",
        ],
    )

    add_heading(document, "1 АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ", new_page=True)
    add_heading(document, "1.1 Назначение и целевая аудитория", level=2)
    add_body(
        document,
        "VoxSekai предназначен для пользователей, которым нужен единый интерфейс для знакомства с музыкальным каталогом и организации личной коллекции. Основная аудитория — люди, регулярно использующие цифровые музыкальные сервисы. Пол, уровень дохода и образование не являются определяющими характеристиками аудитории [2].",
    )
    add_body(
        document,
        "Сервис решает задачи быстрого поиска треков и исполнителей, просмотра тематических подборок и событий, воспроизведения доступного аудио, формирования избранного и плейлистов. Дополнительной механикой является статистика музыкальных вкусов по жанрам и исполнителям [1, 3].",
    )
    add_heading(document, "1.2 Роли пользователей", level=2)
    add_table_caption(document, 1, "Роли и доступные действия")
    add_table(
        document,
        ["Роль", "Доступные действия"],
        [
            ("Гость", "Просмотр главной страницы, каталога, исполнителей, подборок, событий и публичных плейлистов; регистрация и вход."),
            ("Пользователь", "Действия гостя; профиль, избранное, личные плейлисты, оценка треков."),
            ("Администратор", "Управление треками, исполнителями, стилями, подборками, плейлистами, событиями и пользователями."),
        ],
        widths=[3.5, 14.0],
    )
    add_heading(document, "1.3 Анализ аналогов", level=2)
    add_body(
        document,
        "В качестве аналогов рассмотрены Spotify, Яндекс Музыка и VK Музыка. Анализ показал, что для учебного сервиса важны ясная навигация, быстрый поиск, заметные карточки контента, персональная библиотека и минимальное количество действий до воспроизведения [3].",
    )
    add_table_caption(document, 2, "Сравнение музыкальных сервисов")
    add_table(
        document,
        ["Аналог", "Сильные стороны", "Что использовано в VoxSekai"],
        [
            ("Spotify", "Рекомендации, плейлисты, крупный каталог, удобные карточки.", "Карточки треков и исполнителей, персональные подборки, постоянный плеер."),
            ("Яндекс Музыка", "Поиск, подборки по настроению, жанровые фильтры.", "Поиск по каталогу, жанровые фильтры, тематические коллекции."),
            ("VK Музыка", "Быстрый доступ к библиотеке и мобильный интерфейс.", "Боковая навигация, избранное, плейлисты, адаптивная компоновка."),
        ],
        widths=[3.0, 7.0, 7.5],
        font_size=10,
    )
    add_heading(document, "1.4 Пользовательские истории", level=2)
    add_user_stories_table(document, 3)

    add_heading(document, "2 ПРОЕКТИРОВАНИЕ СИСТЕМЫ", new_page=True)
    add_heading(document, "2.1 Информационная архитектура", level=2)
    add_body(
        document,
        "Карта сайта показывает переходы между главной страницей, каталогом, карточками сущностей, авторизацией, профилем, пользовательской библиотекой и событиями. Основной сценарий строится вокруг поиска трека и последующего сохранения в личную коллекцию.",
    )
    add_picture(document, SITE_MAP, 1, "Карта сайта VoxSekai", width_cm=17.0)
    add_body(
        document,
        "Публичные разделы доступны без сессии. При обращении к профилю, избранному или пользовательским плейлистам сервер перенаправляет гостя на страницу входа и сохраняет внутренний адрес возврата.",
    )
    add_heading(document, "2.2 Проектная модель данных", level=2)
    add_body(
        document,
        "На этапе проектирования была подготовлена расширенная ER-модель с пользователями, исполнителями, треками, жанрами, подборками, плейлистами, избранным, оценками и событиями. Проектная модель представлена на рисунке 2.",
    )
    add_picture(document, ER_DIAGRAM, 2, "Проектная ER-диаграмма", width_cm=17.0)
    add_body(
        document,
        "В итоговой реализации модель адаптирована под локальный учебный запуск. Серверные сущности хранятся в SQLite, а избранное, личные плейлисты, данные профиля и состояние плеера — в localStorage браузера. Отдельная таблица жанров не создана: жанр хранится в записи трека, а таблицы стилей вынесены в самостоятельные справочники.",
    )
    add_heading(document, "2.3 Архитектура приложения", level=2)
    add_table_caption(document, 4, "Компоненты программной архитектуры")
    add_table(
        document,
        ["Компонент", "Назначение"],
        [
            ("server.js", "Настройка Express, публичные маршруты, сессии, обработчики регистрации, входа, оценок и ошибок."),
            ("routes/admin.js", "Маршруты административной панели и проверка роли администратора."),
            ("repositories/", "SQL-запросы и преобразование строк базы данных в объекты представления."),
            ("db/", "Подключение SQLite, схема, миграции, внешние ключи и начальные стили."),
            ("views/", "EJS-шаблоны страниц и переиспользуемые partials."),
            ("assets/", "CSS, клиентский JavaScript, изображения и загруженные медиа."),
        ],
        widths=[4.0, 13.5],
    )
    add_body(
        document,
        "Приложение использует серверный рендеринг. Express обрабатывает запрос, обращается к репозиторию, передаёт данные EJS-шаблону и возвращает готовый HTML. Клиентский JavaScript отвечает за интерактивность плеера, фильтры, избранное, личные плейлисты и статистику профиля.",
    )
    add_heading(document, "2.4 Проектирование интерфейса", level=2)
    add_body(
        document,
        "Макет интерфейса подготовлен в Figma [4]. Визуальная концепция основана на тёмном фоне, мятном акцентном цвете, контрастной типографике и карточной структуре. Сквозная боковая навигация позволяет быстро переходить между каталогом, исполнителями, подборками и событиями.",
    )
    add_body(
        document,
        "Интерфейс проектировался на базе семантического HTML5 [15], CSS [16] и JavaScript [17]. Для элементов управления используются подписи, состояния наведения, клавиатурный фокус и ARIA-атрибуты. Рекомендации WCAG применялись как ориентир доступности [20].",
    )

    add_heading(document, "3 ПРОГРАММНАЯ РЕАЛИЗАЦИЯ", new_page=True)
    add_heading(document, "3.1 Технологический стек", level=2)
    add_body(
        document,
        "Серверная часть работает на Node.js [6]. HTTP-маршрутизация и middleware реализованы с помощью Express [7], шаблоны формируются EJS [8]. Данные сохраняются в SQLite [9] через синхронный драйвер better-sqlite3 [10]. Сессии поддерживает express-session [11], загрузку файлов — Multer [12]. Зависимости устанавливаются через npm [22], история проекта ведётся в Git [21].",
    )
    add_body(
        document,
        "Исходный код проекта размещён в репозитории GitHub: https://github.com/Yoshimru/voxsekai.",
    )
    add_table_caption(document, 5, "Использованные технологии")
    add_table(
        document,
        ["Технология", "Назначение", "Версия в проекте"],
        [
            ("Node.js", "Среда выполнения серверного JavaScript", ">= 20"),
            ("Express", "Маршруты и middleware", "4.21.2"),
            ("EJS", "Серверные HTML-шаблоны", "3.1.10"),
            ("better-sqlite3", "Доступ к SQLite", "12.11.1"),
            ("express-session", "Серверные сессии", "1.19.0"),
            ("Multer", "Приём multipart/form-data", "2.5.0"),
        ],
        widths=[4.0, 9.0, 4.5],
    )
    add_heading(document, "3.2 Публичная часть", level=2)
    add_body(
        document,
        "Публичная часть включает главную страницу, каталог, страницы исполнителей, треков, подборок, событий и публичных плейлистов. Общие элементы вынесены в EJS-partials: боковую панель, верхнюю панель, мобильную навигацию, футер, карточки треков и глобальный плеер.",
    )
    add_picture(document, HOME_SCREENSHOT, 3, "Главная страница VoxSekai", width_cm=16.5)
    add_body(
        document,
        "Каталог поддерживает поиск, жанровые фильтры и сортировку. Поиск выполняется на клиенте по данным карточек, уже полученным с сервера. Такой подход достаточен для учебного объёма данных и не требует отдельного API.",
    )
    add_picture(document, CATALOG_SCREENSHOT, 4, "Каталог музыкальных треков", width_cm=16.5)
    add_heading(document, "3.3 База данных", level=2)
    add_body(
        document,
        "SQLite выбрана как встраиваемая база, не требующая отдельного серверного процесса [9]. При первом подключении приложение создаёт каталог и файл базы, включает контроль внешних ключей [24], переводит журнал в режим WAL [25], применяет schema.sql, выполняет простые миграции и добавляет стартовые стили.",
    )
    add_table_caption(document, 6, "Основные таблицы итоговой базы данных")
    add_table(
        document,
        ["Таблица", "Назначение"],
        [
            ("users", "Учётные записи, e-mail, хеш пароля, роль и дата создания."),
            ("tracks", "Метаданные треков, длительность, жанр, обложка и URL аудио."),
            ("artists", "Исполнители и отображаемые характеристики."),
            ("artist_tracks", "Связь исполнителей и треков."),
            ("collections", "Тематические подборки."),
            ("collection_tracks", "Состав подборок."),
            ("playlists", "Серверные и публичные плейлисты."),
            ("playlist_tracks", "Состав плейлистов."),
            ("events", "Музыкальные события."),
            ("track_ratings", "Оценка 1–5 для пары пользователь–трек."),
            ("*_styles", "Редактируемые визуальные стили сущностей."),
        ],
        widths=[5.0, 12.5],
    )
    add_heading(document, "3.4 Регистрация, сессии и разграничение доступа", level=2)
    add_body(
        document,
        "При регистрации сервер проверяет длину имени, формат e-mail, минимальную длину пароля и уникальность учётных данных. Пароль преобразуется функцией scrypt из стандартного модуля crypto с индивидуальной случайной солью [23]. Такой подход соответствует общему принципу хранения паролей в виде стойкого адаптивного хеша [18].",
    )
    add_body(
        document,
        "После входа идентификатор пользователя хранится в серверной сессии. Cookie настроена с флагами HttpOnly и SameSite=Lax. Проверка административной роли выполняется на сервере до обработки защищённых маршрутов. Рекомендации OWASP по управлению сессиями использованы как ориентир [19].",
    )
    add_heading(document, "3.5 Клиентское состояние и аудиоплеер", level=2)
    add_body(
        document,
        "Клиентская часть использует Web Storage API [13]. В localStorage сохраняются идентификаторы избранных треков, личные плейлисты, настройки профиля и состояние плеера. Состояние синхронизируется между вкладками через событие storage.",
    )
    add_body(
        document,
        "Глобальный плеер поддерживает запуск и паузу, очередь, предыдущий и следующий треки, перемотку и громкость. При наличии audioUrl используется HTMLAudioElement; при отсутствии файла интерфейс работает в демонстрационном режиме. Клиентские запросы и взаимодействие с HTTP основаны на стандартных возможностях браузера и Fetch API [14].",
    )
    add_heading(document, "3.6 Административная панель", level=2)
    add_body(
        document,
        "Административная панель позволяет создавать, редактировать и удалять треки и исполнителей, управлять подборками, плейлистами, событиями, пользователями и визуальными стилями. Для обложек разрешены JPG, PNG, WEBP, GIF и AVIF размером до 6 МБ. Для аудио разрешены MP3, WAV, OGG, M4A, FLAC и WEBM размером до 30 МБ.",
    )
    add_picture(document, ADMIN_SCREENSHOT, 5, "Страница входа в административную панель", width_cm=16.5)
    add_body(
        document,
        "Файлы получают случайные имена и сохраняются в assets/uploads. При замене или удалении локального медиа старый файл удаляется. SQL-запросы выполняются подготовленными выражениями better-sqlite3, что отделяет значения параметров от текста запроса.",
    )
    add_heading(document, "3.7 Отличия реализации от первоначальных требований", level=2)
    add_body(
        document,
        "В исходных материалах предлагались PHP и MySQL [1–3]. В итоговом проекте применены Node.js и SQLite. Замена не изменила пользовательское назначение, но упростила локальный запуск: приложение не требует отдельного веб-сервера и СУБД. Одновременно часть пользовательских данных реализована на стороне браузера, поэтому личные плейлисты и избранное не синхронизируются между устройствами.",
    )
    add_body(
        document,
        "Текущая версия является учебным прототипом. Перед публичным размещением необходимо вынести ключ сессии и данные начального администратора в переменные окружения, использовать постоянное хранилище сессий, добавить CSRF-защиту, журналирование и резервное копирование загруженных файлов.",
    )

    add_heading(document, "4 ТЕСТИРОВАНИЕ", new_page=True)
    add_heading(document, "4.1 Подход к тестированию", level=2)
    add_body(
        document,
        "Для проверки основных серверных сценариев создано 15 интеграционных тестов на встроенном модуле node:test. Каждый прогон использует временную SQLite-базу и случайный свободный порт, поэтому рабочие данные проекта не изменяются.",
    )
    add_heading(document, "4.2 Результаты", level=2)
    add_table_caption(document, 7, "Результаты интеграционного тестирования")
    test_rows = [(case["id"], case["name"], "Пройден") for case in TEST_CASES]
    add_table(document, ["ID", "Проверка", "Результат"], test_rows, widths=[2.0, 12.5, 3.0], font_size=10)
    add_table_caption(document, 8, "Сводные показатели тестирования")
    add_table(
        document,
        ["Показатель", "Значение"],
        [
            ("Всего", "15"),
            ("Успешно", "15"),
            ("Неуспешно", "0"),
            ("Пропущено", "0"),
            ("Успешность", "100 %"),
            ("Продолжительность", "573,54 мс"),
        ],
        widths=[12.0, 5.5],
    )
    add_body(
        document,
        "Все проверки завершились успешно. Подтверждены доступность публичных страниц, корректная обработка 404, регистрация, вход по e-mail, выход, защита профиля, сохранение оценки и ролевой доступ администратора. Полное описание шагов находится в отдельном документе «Тест-кейсы VoxSekai».",
    )
    add_heading(document, "4.3 Ограничения проверки", level=2)
    add_body(
        document,
        "Автоматизированный набор не проверяет визуальное соответствие макету, поведение на физических мобильных устройствах, реальное воспроизведение каждого аудиоформата, ограничения multipart-загрузки и доступность с экранным диктором. Для полного приёмочного тестирования эти сценарии следует вынести в отдельный браузерный набор.",
    )

    add_heading(document, "5 УСТАНОВКА И ЭКСПЛУАТАЦИЯ", new_page=True)
    add_heading(document, "5.1 Системные требования", level=2)
    add_bullets(
        document,
        [
            "64-разрядная операционная система Windows, Linux или macOS;",
            "Node.js версии 20 или новее;",
            "npm и доступ к реестру пакетов при первой установке;",
            "современный браузер с поддержкой localStorage и HTMLAudioElement;",
            "свободный порт 3001 или другой порт, заданный переменной PORT.",
        ],
    )
    add_heading(document, "5.2 Установка и запуск", level=2)
    add_body(
        document,
        "После копирования проекта необходимо выполнить команды npm ci и npm start. Сервер запускается по адресу http://localhost:3001. В Windows можно открыть start.bat и воспользоваться интерактивным меню установки, запуска, остановки и перезапуска.",
    )
    add_table_caption(document, 9, "Переменные окружения")
    add_table(
        document,
        ["Переменная", "Значение по умолчанию", "Назначение"],
        [
            ("PORT", "3001", "Порт HTTP-сервера."),
            ("VOXSEKAI_DB", "db/voxsekai.db", "Путь к файлу SQLite."),
        ],
        widths=[4.0, 5.0, 8.5],
    )
    add_heading(document, "5.3 Хранение и перенос данных", level=2)
    add_body(
        document,
        "Для переноса серверных данных необходимо копировать SQLite-файл и каталог assets/uploads. Данные localStorage относятся к конкретному браузеру и профилю пользователя, поэтому обычное копирование сервера их не переносит. Перед удалением базы сервер требуется остановить, чтобы корректно завершить работу WAL-файлов.",
    )
    add_heading(document, "5.4 Повторный запуск тестов", level=2)
    add_body(
        document,
        "Интеграционный набор запускается командой npm run test:report. Успешный прогон должен завершиться строками tests 15, pass 15 и fail 0. Тесты не требуют предварительно запущенного экземпляра приложения.",
    )

    document.add_page_break()
    add_structural_heading(document, "ЗАКЛЮЧЕНИЕ")
    add_body(
        document,
        "В результате проекта разработан работоспособный музыкальный веб-сервис VoxSekai. Реализованы публичный каталог, страницы треков и исполнителей, подборки, события, публичные и личные плейлисты, избранное, профиль, аудиоплеер, регистрация, вход, оценки и административная панель.",
    )
    add_body(
        document,
        "Серверная часть построена на Node.js, Express и EJS, данные хранятся в SQLite. Архитектура разделяет маршруты, репозитории, представления, статические ресурсы и слой базы данных. Пароли хешируются с помощью scrypt, SQL-запросы параметризованы, доступ к административным маршрутам проверяется на сервере.",
    )
    add_body(
        document,
        "Подготовленный набор из 15 интеграционных тестов выполнен без ошибок. Таким образом, основные цели учебного проекта достигнуты. Дальнейшее развитие может включать серверное хранение пользовательских плейлистов и избранного, полноценную систему рекомендаций, регистрацию на события, постоянное хранилище сессий и расширенное браузерное тестирование.",
    )

    document.add_page_break()
    add_structural_heading(document, "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ")
    sources = [
        "Требования к учебному проекту команды 2 «Атмосфера» // Проект (1).docx. 2026.",
        "Бриф на создание музыкального веб-сервиса VoxSekai // Бриф .docx. 2026.",
        "Анализ трёх аналогов и восемь user stories // 3 аналога + 8 user stories.docx. 2026.",
        "Макет VoxSekai в Figma [Электронный ресурс]. URL: https://www.figma.com/design/mxB7ZC8Ad7nbQvOevQRUZm/maket (дата обращения: 09.11.2026).",
        "Методические указания по оформлению дипломных работ // oformlenie_1.docx. 2026.",
        "Node.js Documentation [Электронный ресурс]. URL: https://nodejs.org/docs/latest/api/ (дата обращения: 09.11.2026).",
        "Express 4.x API Reference [Электронный ресурс]. URL: https://expressjs.com/en/4x/api.html (дата обращения: 09.11.2026).",
        "EJS Documentation [Электронный ресурс]. URL: https://ejs.co/ (дата обращения: 09.11.2026).",
        "SQLite Documentation [Электронный ресурс]. URL: https://www.sqlite.org/docs.html (дата обращения: 09.11.2026).",
        "better-sqlite3 API Documentation [Электронный ресурс]. URL: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md (дата обращения: 09.11.2026).",
        "express-session [Электронный ресурс]. URL: https://github.com/expressjs/session (дата обращения: 09.11.2026).",
        "Multer Documentation [Электронный ресурс]. URL: https://github.com/expressjs/multer (дата обращения: 09.11.2026).",
        "Web Storage API // MDN Web Docs [Электронный ресурс]. URL: https://developer.mozilla.org/docs/Web/API/Web_Storage_API (дата обращения: 09.11.2026).",
        "Fetch API // MDN Web Docs [Электронный ресурс]. URL: https://developer.mozilla.org/docs/Web/API/Fetch_API (дата обращения: 09.11.2026).",
        "HTML Living Standard [Электронный ресурс]. URL: https://html.spec.whatwg.org/ (дата обращения: 09.11.2026).",
        "CSS Snapshot [Электронный ресурс]. URL: https://www.w3.org/TR/CSS/ (дата обращения: 09.11.2026).",
        "ECMAScript Language Specification [Электронный ресурс]. URL: https://tc39.es/ecma262/ (дата обращения: 09.11.2026).",
        "OWASP Password Storage Cheat Sheet [Электронный ресурс]. URL: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (дата обращения: 09.11.2026).",
        "OWASP Session Management Cheat Sheet [Электронный ресурс]. URL: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (дата обращения: 09.11.2026).",
        "Web Content Accessibility Guidelines 2.2 [Электронный ресурс]. URL: https://www.w3.org/TR/WCAG22/ (дата обращения: 09.11.2026).",
        "Git Documentation [Электронный ресурс]. URL: https://git-scm.com/docs (дата обращения: 09.11.2026).",
        "npm Docs [Электронный ресурс]. URL: https://docs.npmjs.com/ (дата обращения: 09.11.2026).",
        "Node.js Crypto: scrypt [Электронный ресурс]. URL: https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options (дата обращения: 09.11.2026).",
        "SQLite Foreign Key Support [Электронный ресурс]. URL: https://www.sqlite.org/foreignkeys.html (дата обращения: 09.11.2026).",
        "Write-Ahead Logging // SQLite [Электронный ресурс]. URL: https://www.sqlite.org/wal.html (дата обращения: 09.11.2026).",
    ]
    for index, source in enumerate(sources, 1):
        add_body(document, f"{index} {source}", first_indent=True)

    document.add_page_break()
    add_structural_heading(document, "ПРИЛОЖЕНИЕ А", include_in_toc=True)
    add_centered(document, "ОСНОВНЫЕ МАРШРУТЫ ПРИЛОЖЕНИЯ", bold=True)
    add_table_caption(document, 10, "Публичные и пользовательские маршруты")
    add_table(
        document,
        ["Метод", "Маршрут", "Назначение"],
        [
            ("GET", "/", "Главная страница."),
            ("GET", "/catalog", "Каталог треков."),
            ("GET", "/artists и /artists/:slug", "Список и карточка исполнителя."),
            ("GET", "/track/:slug", "Карточка трека."),
            ("POST", "/track/:slug/rate", "Сохранение оценки пользователя."),
            ("GET", "/collections и /collections/:slug", "Подборки и карточка подборки."),
            ("GET", "/events и /events/:slug", "События и карточка события."),
            ("GET", "/playlists", "Личные плейлисты."),
            ("GET", "/public-playlists", "Публичные плейлисты."),
            ("POST", "/register", "Регистрация."),
            ("POST", "/login", "Вход."),
            ("POST", "/logout", "Выход."),
            ("GET", "/admin", "Административный дашборд."),
        ],
        widths=[2.2, 6.0, 9.3],
        font_size=10,
    )

    document.add_page_break()
    add_structural_heading(document, "ПРИЛОЖЕНИЕ Б", include_in_toc=True)
    add_centered(document, "ПРОТОКОЛ АВТОМАТИЗИРОВАННОГО ТЕСТИРОВАНИЯ", bold=True)
    add_body(document, "Команда запуска: npm run test:report", first_indent=False)
    add_body(
        document,
        "Результат: tests 15; pass 15; fail 0; cancelled 0; skipped 0; todo 0; duration_ms 573.535.",
        first_indent=False,
    )
    add_body(
        document,
        "Прогон выполнен на временной SQLite-базе. Подробные предусловия, шаги и результаты каждого теста приведены в документе «Тест-кейсы VoxSekai».",
    )

    path = OUTPUT_DIR / "Отчёт по проекту VoxSekai.docx"
    document.save(path)
    return path


if __name__ == "__main__":
    generated = [build_test_report(), build_project_report()]
    for path in generated:
        print(path)
