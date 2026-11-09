import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def open_settings(page):
    page.get_by_role("button", name="设置").click()
    dialog = page.get_by_role("dialog", name="NekoPapa 设置")
    expect(dialog).to_be_visible()
    return dialog


def expect_discard_prompt(page):
    prompt = page.get_by_role("alertdialog")
    expect(prompt).to_be_visible()
    expect(prompt.get_by_role("button", name="继续编辑")).to_be_visible()
    expect(prompt.get_by_role("button", name="放弃更改")).to_be_visible()
    return prompt


def cancel_prompt(page):
    prompt = expect_discard_prompt(page)
    prompt.get_by_role("button", name="继续编辑").click()
    expect(page.get_by_role("alertdialog")).to_have_count(0)
    page.wait_for_timeout(300)


def main():
    url = os.environ.get("NEKOPAPA_TEST_URL", "http://127.0.0.1:1497/")
    executable = os.environ.get("BROWSER_EXECUTABLE")
    if not executable:
        chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        executable = str(chrome) if chrome.exists() else None

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.set_default_timeout(5000)
        page.goto(url, wait_until="domcontentloaded")

        settings = open_settings(page)
        page.get_by_role("button", name="个人资料").click()
        profile = page.get_by_role("textbox", name="显示名称")
        profile.fill("未保存资料草稿")
        page.get_by_role("button", name="外观").click()
        dark_mode = page.get_by_role("radio", name="深色")
        dark_mode.check(force=True)
        expect(dark_mode).to_be_checked()
        page.get_by_role("button", name="个人资料").click()
        expect(profile).to_have_value("未保存资料草稿")

        page.get_by_role("button", name="关闭设置").click()
        expect_discard_prompt(page)
        cancel_prompt(page)

        page.keyboard.press("Escape")
        expect_discard_prompt(page)
        cancel_prompt(page)

        page.mouse.click(8, 8)
        expect_discard_prompt(page)
        cancel_prompt(page)

        page.keyboard.press("Meta+,")
        expect_discard_prompt(page)
        expect_discard_prompt(page).get_by_role("button", name="放弃更改").click()
        expect(settings).to_be_hidden()

        settings = open_settings(page)
        page.get_by_role("button", name="外观").click()
        light_mode = page.get_by_role("radio", name="浅色")
        light_mode.check(force=True)
        expect(light_mode).to_be_checked()
        page.get_by_role("button", name="个人资料").click()
        page.get_by_role("textbox", name="显示名称").fill("应被取消的资料")
        page.get_by_role("region", name="个人资料").get_by_role("button", name="取消").click()
        expect_discard_prompt(page)
        cancel_prompt(page)

        page.get_by_role("button", name="数据与备份").click()
        page.get_by_role("button", name="关闭", exact=True).click()
        expect_discard_prompt(page)
        print("Settings close guard passed: close button, Escape, backdrop, shortcut, section drafts, and explicit cancel.")
        browser.close()


if __name__ == "__main__":
    main()
