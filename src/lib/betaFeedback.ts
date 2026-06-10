/**
 * 封闭测试问卷链接。
 * 在腾讯问卷 / Google 表单建好後，把发布链接贴到下面即可。
 * 留空则应用内不显示「填写测试问卷」按钮。
 */
export const BETA_SURVEY_URL = "";

/** 是否显示测试问卷入口 */
export function hasBetaSurveyLink(): boolean {
  return BETA_SURVEY_URL.trim().length > 0;
}
