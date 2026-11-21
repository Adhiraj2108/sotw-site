export const services = ["Positioning & Messaging", "Visual Identity", "Logo", "Web Design", "Web Development", "Other", "Not sure yet"];
export const budgets = ["Under $3,000", "$3,000 - $6,000", "$6,000 - $10,000", "$10,000+"];
export const limits = { name: 100, company: 200, email: 254, website: 2048, projectInfo: 10000, referral: 300, launchDate: 200 };
export const minimums = { name: 2, projectInfo: 20 };
export const wordLimits = { projectInfo: 500 };
export const countWords = text => (typeof text === "string" ? text.match(/\S+/g)?.length ?? 0 : 0);
/** Field order on the page, used to focus the first problem. */
export const fieldOrder = ["name", "company", "email", "website", "projectInfo", "services", "referral", "budget", "launchDate"];
/** Submissions completed faster than this are treated as automated. */
export const minFillTimeMs = 3000;

const multiline = new Set(["projectInfo"]);
// C0/C1 controls (except tab and newline), zero-width and bidi override characters.
const invisible = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;
const emailPattern = /^(?=.{6,254}$)(?=[^@]{1,64}@)[a-z\d!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z\d!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:[a-z]{2,63}|xn--[a-z\d-]{1,59})$/i;
const hostPattern = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:[a-z]{2,63}|xn--[a-z\d-]{1,59})$/i;
const commonDomains = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "protonmail.com"];

function clean(value, keepLines) {
  let text = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(invisible, "");
  if (!keepLines) return text.replace(/\s+/g, " ").trim();
  return text.replace(/[^\S\n]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

/** Suggests a correction for a likely mistyped common email domain, e.g. gmial.com → gmail.com. */
export function suggestEmail(email) {
  const at = typeof email === "string" ? email.lastIndexOf("@") : -1;
  if (at < 1) return "";
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || commonDomains.includes(domain)) return "";
  const match = commonDomains.find(candidate => distance(domain, candidate) <= 2);
  return match ? `${email.slice(0, at)}@${match}` : "";
}

export function validateEnquiry(input) {
  const errors = {};
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    if (input[key] !== undefined && input[key] !== null && typeof input[key] !== "string") errors[key] = "Please enter text.";
    data[key] = typeof input[key] === "string" ? clean(input[key], multiline.has(key)) : "";
    if (data[key].length > max) errors[key] = `Please use ${max.toLocaleString("en")} characters or fewer.`;
  }
  const required = { name: "your name", company: "your company name", email: "your email address", projectInfo: "a few details about your project", launchDate: "your launch date or timeline" };
  for (const [key, label] of Object.entries(required)) {
    if (!data[key] && !errors[key]) errors[key] = `Please enter ${label}.`;
  }
  for (const [key, min] of Object.entries(minimums)) {
    if (data[key] && !errors[key] && data[key].length < min) {
      errors[key] = key === "projectInfo"
        ? `Please tell us a little more (at least ${min} characters).`
        : `Please enter at least ${min} characters.`;
    }
  }
  for (const [key, max] of Object.entries(wordLimits)) {
    const words = countWords(data[key]);
    if (!errors[key] && words > max) errors[key] = `Please keep this to ${max} words or fewer (currently ${words}).`;
  }
  if (data.name && !errors.name && !/\p{L}/u.test(data.name)) errors.name = "Please enter your name using letters.";
  if (data.name && !errors.name && /https?:\/\/|www\./i.test(data.name)) errors.name = "Please enter your name, not a link.";
  if (data.company && !errors.company && !/[\p{L}\p{N}]/u.test(data.company)) errors.company = "Please enter your company name.";
  if (data.email && !errors.email) {
    if (!emailPattern.test(data.email) || data.email.includes("..")) errors.email = "Please enter a valid email address, such as jane@acme.com.";
    else {
      const at = data.email.lastIndexOf("@");
      data.email = data.email.slice(0, at) + "@" + data.email.slice(at + 1).toLowerCase();
    }
  }
  if (data.website && !errors.website) {
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(data.website) ? data.website : `https://${data.website}`);
      if (!["https:", "http:"].includes(url.protocol) || !hostPattern.test(url.hostname) || url.username || url.password) throw new Error();
      data.website = url.href;
    } catch { errors.website = "Please enter a valid website, such as acme.com."; }
  }
  if (!Array.isArray(input.services) || !input.services.length || input.services.some(s => !services.includes(s)) || input.services.length > services.length) errors.services = "Please select at least one service.";
  data.services = Array.isArray(input.services) ? [...new Set(input.services.filter(s => services.includes(s)))] : [];
  data.budget = typeof input.budget === "string" ? input.budget : "";
  if (!budgets.includes(data.budget)) errors.budget = "Please select your estimated budget.";
  const ordered = Object.fromEntries(fieldOrder.filter(key => errors[key]).map(key => [key, errors[key]]));
  return { data, errors: ordered, valid: Object.keys(ordered).length === 0 };
}
