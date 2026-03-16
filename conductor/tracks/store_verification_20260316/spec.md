# Specification: Store Verification & Data Enrichment Workflow

## 1. Objective
Implement a robust workflow to verify the status of potential leads by determining if a target URL corresponds to an active, Shopify-powered e-commerce store. This forms the foundation of the data enrichment pipeline.

## 2. Context
Yolysi CRM relies on high-quality data. Ingested leads (from Store Leads or CSV) must be validated before entering the nurturing funnel. This feature ensures we only target active, relevant businesses.

## 3. Requirements

### 3.1 Input
- A Store URL or Domain Name (e.g., `example.com`, `myshopify.com`).

### 3.2 Process (The "Enrichment Engine")
1.  **Connectivity Check:** Attempt to reach the URL via HTTP/HTTPS.
2.  **Platform Detection:** Analyze the HTTP response (headers and HTML body) for definitive Shopify indicators:
    -   `window.Shopify` object in JavaScript.
    -   Specific meta tags (e.g., `<meta name="shopify-checkout-api-token">`).
    -   CDN paths (e.g., `cdn.shopify.com`).
3.  **Status Determination:** Classify the store based on findings.

### 3.3 Output
- **Status:** `Active`, `Inactive`, `Unreachable`.
- **Platform:** `Shopify`, `Other`, `Unknown`.
- **Metadata:** Capture basic site info (Title, Description) if accessible.

## 4. Technical Considerations
- **Convex Actions:** Use Convex `action` for external HTTP requests (fetching the page).
- **Rate Limiting:** Ensure the verification process respects target site limits and internal quotas.
- **Error Handling:** Gracefully handle timeouts, redirects, and 4xx/5xx errors.

## 5. Acceptance Criteria
- [ ] The system can accept a URL and return a verification result.
- [ ] Correctly identifies a known active Shopify store.
- [ ] Correctly identifies a non-Shopify site.
- [ ] Correctly identifies an inactive/broken link.
- [ ] Results are persisted to the Convex database.
