import { chooseCharacter, isUnsafeUtterance } from "../speechHelpers";

describe("auto-reply routing", () => {
  test("routes to nurse for vitals/oxygen asks", () => {
    expect(chooseCharacter("Can you get vitals and oxygen?")).toBe("nurse");
  });

  test("routes to tech for ekg/xray keywords", () => {
    expect(chooseCharacter("Please get an ekg and monitor strip")).toBe("tech");
    expect(chooseCharacter("Grab a chest xray")).toBe("tech");
  });

  test("routes to consultant for consult terms", () => {
    expect(chooseCharacter("Need cardiology consult")).toBe("consultant");
  });

  test("routes to parent for family history", () => {
    expect(chooseCharacter("Any family history mom or dad heart issues?")).toBe("parent");
  });
});

describe("auto-reply safety", () => {
  test("flags profanity", () => {
    expect(isUnsafeUtterance("This is shit")).toBe(true);
  });
  test("flags long numbers that look like phone/ID", () => {
    expect(isUnsafeUtterance("Call 555-123-4567")).toBe(true);
  });
  test("passes clean text", () => {
    expect(isUnsafeUtterance("How are you feeling?")).toBe(false);
  });
});
