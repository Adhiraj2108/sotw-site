export const services = ["Positioning & Messaging", "Visual Identity", "Logo", "Web Design", "Web Development", "Other", "Not sure yet"];
export const budgets = ["Under $3,000", "$3,000 - $6,000", "$6,000 - $10,000", "$10,000+"];
export const limits = { name: 100, company: 200, email: 254, website: 2048, projectInfo: 10000, referral: 300, launchDate: 200 };

export function validateEnquiry(input) {
  const errors = {};
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    if (input[key] !== undefined && typeof input[key] !== "string") errors[key] = "Please enter text.";
    data[key] = typeof input[key] === "string" ? input[key].trim() : "";
    if (data[key].length > max) errors[key] = `Please use ${max} characters or fewer.`;
  }
  for (const [key, label] of Object.entries({ name: "your name", company: "your company name", email: "your email", projectInfo: "your project details", launchDate: "your launch timeline" })) {
    if (!data[key]) errors[key] = `Please enter ${label}.`;
  }
  if (data.email && !/^[^\s@<>\r\n]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(data.email)) errors.email = "Please enter a valid email address.";
  if (/[\r\n]/.test(data.name)) errors.name = "Please enter your name on one line.";
  if (data.website) {
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(data.website) ? data.website : `https://${data.website}`);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) throw new Error();
      data.website = url.href;
    } catch { errors.website = "Please enter a valid website, such as https://example.com."; }
  }
  if (!Array.isArray(input.services) || !input.services.length || input.services.some(s => !services.includes(s)) || input.services.length > services.length) errors.services = "Please select at least one service from the list.";
  data.services = Array.isArray(input.services) ? [...new Set(input.services.filter(s => services.includes(s)))] : [];
  data.budget = typeof input.budget === "string" ? input.budget : "";
  if (!budgets.includes(data.budget)) errors.budget = "Please select your estimated budget.";
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
