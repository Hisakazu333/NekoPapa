import { hostCall } from "./project-workspace-client";
import { readSkillScan, type SkillScan } from "./skill-discovery";

/** Lists skill folders on this computer (desktop command, or the dev server in the browser preview). */
export const scanSkillFolders = (): Promise<SkillScan> => hostCall("scan_skill_folders", "skills/scan", {}, readSkillScan);
