from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173/")

        # Wait for the loading overlay to disappear
        loading_overlay = page.locator("#loadingOverlay")
        expect(loading_overlay).to_be_hidden(timeout=30000)

        # Wait for at least one marker to be visible
        # This indicates the data has loaded and markers are rendered
        page.wait_for_selector(".custom-marker", timeout=30000)

        # Give the map a moment to settle
        page.wait_for_timeout(2000)

        # Take a screenshot of the map container
        map_container = page.locator(".map-container")
        map_container.screenshot(path="jules-scratch/verification/verification.png")

        print("Screenshot saved to jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
