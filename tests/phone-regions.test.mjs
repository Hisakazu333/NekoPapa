import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-phone-regions-"));
let module;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./phone-regions-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const path = join(output, "app/account/phone-regions.js");
  writeFileSync(path, readFileSync(path, "utf8").replace('"./phone-region-codes"', '"./phone-region-codes.js"'));
  module = await import(pathToFileURL(path));
} finally { rmSync(output, { recursive: true, force: true }); }

const { accountPhoneNumber, detectPhoneRegion, DEFAULT_PHONE_REGION, PHONE_REGIONS, phoneRegion, phoneRegionMatches, phoneRegionName, phoneRegionShowsFlag, sortedPhoneRegions } = module;

test("默认 +86，大陆号码保持账号服务现有的 11 位格式", () => {
  assert.equal(DEFAULT_PHONE_REGION, "CN");
  assert.equal(accountPhoneNumber("CN", "138 0000 0000"), "13800000000");
  assert.equal(accountPhoneNumber("CN", "23800000000"), undefined);
  assert.equal(accountPhoneNumber("CN", "1380000000"), undefined);
});

test("其他地区按用户所选区号发送 E.164，并去掉本地长途前缀 0", () => {
  assert.equal(accountPhoneNumber("GB", "07700 900123"), "+447700900123");
  assert.equal(accountPhoneNumber("US", "(202) 555-0123"), "+12025550123");
  assert.equal(accountPhoneNumber("CA", "6135550123"), "+16135550123");
  assert.equal(accountPhoneNumber("HK", "9123 4567"), "+85291234567");
  assert.equal(accountPhoneNumber("IT", "06 1234 5678"), "+390612345678");
});

test("非数字、过短或超过 15 位的号码不会发送", () => {
  assert.equal(accountPhoneNumber("GB", "07700-abc"), undefined);
  assert.equal(accountPhoneNumber("GB", "123"), undefined);
  assert.equal(accountPhoneNumber("AE", "1234567890123"), undefined);
  assert.equal(accountPhoneNumber("GB", ""), undefined);
});

test("地区 ID 唯一，共用 +1 的地区仍可区分；未知地区回到默认", () => {
  const ids = PHONE_REGIONS.map((region) => region.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PHONE_REGIONS.every((region) => /^[1-9]\d{0,2}$/.test(region.dialCode)));
  assert.equal(phoneRegion("ZZ").id, "CN");
});

test("覆盖全球地区，名称随界面语言生成，可按名称、英文名或区号搜索", () => {
  assert.ok(PHONE_REGIONS.length >= 240);
  assert.equal(phoneRegionName("GB", "zh-CN"), "英国");
  assert.equal(phoneRegionName("GB", "en-US"), "United Kingdom");
  const gb = phoneRegion("GB");
  assert.ok(phoneRegionMatches(gb, "zh-CN", "英国"));
  assert.ok(phoneRegionMatches(gb, "zh-CN", "kingdom"));
  assert.ok(phoneRegionMatches(gb, "zh-CN", "+44"));
  assert.ok(!phoneRegionMatches(phoneRegion("ES"), "zh-CN", "4"));
  const { common, all } = sortedPhoneRegions("zh-CN");
  assert.equal(common[0].id, "CN");
  assert.equal(all.length, PHONE_REGIONS.length);
});

test("台湾保留 +886 区号与号码校验，但不显示旗帜", () => {
  assert.equal(phoneRegion("TW").dialCode, "886");
  assert.equal(accountPhoneNumber("TW", "0912 345 678"), "+886912345678");
  assert.equal(phoneRegionShowsFlag("TW"), false);
  assert.equal(phoneRegionShowsFlag("CN"), true);
  assert.equal(phoneRegionShowsFlag("HK"), true);
});

test("输入或粘贴 +区号 / 00区号 时自动切换地区，本地号码不猜测", () => {
  assert.deepEqual(detectPhoneRegion("+44 7700 900123", "CN"), { regionId: "GB", national: "7700900123" });
  assert.deepEqual(detectPhoneRegion("0081 90-1234-5678", "CN"), { regionId: "JP", national: "9012345678" });
  assert.deepEqual(detectPhoneRegion("+852 9123 4567", "CN"), { regionId: "HK", national: "91234567" });
  assert.deepEqual(detectPhoneRegion("+8613800000000", "US"), { regionId: "CN", national: "13800000000" });
  // A shared code keeps the region already chosen; otherwise its main region.
  assert.deepEqual(detectPhoneRegion("+1 613 555 0123", "CA"), { regionId: "CA", national: "6135550123" });
  assert.deepEqual(detectPhoneRegion("+1 202 555 0123", "CN"), { regionId: "US", national: "2025550123" });
  assert.equal(detectPhoneRegion("+", "CN"), undefined);
  assert.equal(detectPhoneRegion("+44", "CN"), undefined);
  assert.equal(detectPhoneRegion("13800000000", "CN"), undefined);
  assert.equal(detectPhoneRegion("07700 900123", "GB"), undefined);
});
