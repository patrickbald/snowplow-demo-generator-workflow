# Image Generation for Demos

Demo websites need realistic, consistent imagery. Use **Nano Banana** (Google's image generation model) to generate demo images.

## Why Nano Banana

- **Consistency**: Excellent at generating standardized variants of the same subject (e.g., different color variants of a product, different angles, series of similar images)
- **Quality**: High-quality, realistic image generation suitable for demo websites
- **Free for manual use**: Available at no cost via the Gemini web UI for small batches
- **API available**: Programmatic access via Google AI Studio / Vertex AI for bulk generation

## Access Options

### Option 1: Manual (Gemini web UI) — No credentials needed

For most demos, manually generating images via [gemini.google.com](https://gemini.google.com/) is sufficient. No API key or setup required. Just prompt, generate, download.

Best for: One-off demos, small image sets (<20 images).

### Option 2: Programmatic (API) — API key required

For bulk generation or scripted workflows, use the Nano Banana API via Google AI Studio or Vertex AI.

**Setup — each user must generate their own API key:**

> **Do not share API keys between users.** Each person should create and manage their own key. Never send keys via Slack, email, or any other channel.

1. Go to [aistudio.google.com](https://aistudio.google.com/) and sign in with your Google account
2. Click "Create API Key" and generate a key
3. Enable billing on your Google Cloud project (the free tier does not support image output)
4. Store the key as an environment variable in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Add to ~/.zshrc or ~/.bashrc
export GOOGLE_AI_API_KEY="your-api-key-here"
```

5. Reload your shell: `source ~/.zshrc` (or restart your terminal)
6. Verify it's set: `echo $GOOGLE_AI_API_KEY`

**Security rules:**
- Store the key **only** in your shell profile — never in a project's `.env`, config file, or source code
- Never commit the key to git
- This is a personal build-time credential, not a runtime dependency of the demo website

**Basic usage (Python):**

```python
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])
model = genai.GenerativeModel('gemini-3-pro-image-preview')

response = model.generate_content(
    ["Athletic jogger pants in navy blue, product photography on white background, studio lighting, centered, e-commerce style"],
    generation_config={
        "response_modalities": ["TEXT", "IMAGE"],
        "image_config": {
            "aspect_ratio": "1:1",
        }
    }
)
```

**Pricing (API only):**
- ~$0.12 per image at 2K resolution
- ~$0.24 per image at 4K resolution
- Free tier: 2-3 images per 24 hours at 1K with watermarks

**Important:** Each user must generate and store their own API key as an environment variable (`GOOGLE_AI_API_KEY`). Never commit keys to git or store them in project files. See the setup steps above.

## When to use image generation

- **Product images**: Generate product photos with color/style variants (proven workflow — used successfully in the retail ecom demo)
- **Hero images / banners**: Generate landing page hero imagery that fits the demo vertical
- **Category images**: Generate representative images for content categories
- **Article/blog thumbnails**: Generate consistent-style thumbnails for content-heavy demos
- **Advertisement creatives**: Generate mock ad banners and sponsored content images
- **Placeholder content**: Any image that would otherwise be a generic stock photo

## Workflow

### Step 1: Plan your image needs

Before generating, list all the images the demo needs. Group them by type:

```
Product images:
  - 6 products × 3 color variants each = 18 images
  - Consistent white background, same angle/lighting

Category images:
  - 4 category headers (e.g., "Outdoor Gear", "Running", "Casual", "Training")
  - Consistent style, lifestyle photography feel

Hero banners:
  - 1 homepage hero
  - 1 seasonal promotion banner
```

### Step 2: Generate in Nano Banana

1. Go to [gemini.google.com](https://gemini.google.com/)
2. Write a detailed prompt describing the image style, subject, and constraints
3. Generate a batch (up to 15-20 at once)
4. Review on the canvas, pick the best results
5. Refine with follow-up prompts if needed
6. Download selected images

### Step 3: Prompting tips for demo images

**For product variants (standardized):**
```
[Product type] in [color], product photography on white background,
studio lighting, centered, e-commerce style, high quality,
consistent angle matching previous images
```

Example: "Athletic jogger pants in navy blue, product photography on white background, studio lighting, centered, e-commerce style"

Then generate the same prompt with different colors: "...in charcoal gray", "...in black", "...in olive green"

**For lifestyle/hero images:**
```
[Scene description] in the style of [aesthetic],
professional photography, [mood/lighting],
suitable for a [vertical] website header
```

Example: "Couple hiking through autumn forest trail, lifestyle photography, warm golden hour lighting, suitable for an outdoor retail website header"

**For article thumbnails (consistent series):**
```
[Subject] in the style of editorial illustration,
clean modern design, [color palette],
suitable for a news article thumbnail, 16:9 aspect ratio
```

### Step 4: Prepare for the demo

- **Resize** images to web-appropriate dimensions (hero: ~1920x1080, products: ~800x800, thumbnails: ~640x360)
- **Optimize** file size — use WebP format where possible, JPEG for photos
- **Name consistently** — use slugified names matching your config (e.g., `align-joggers-navy.webp`)
- **Place in** `public/images/` following the project structure:

```
public/images/
├── products/           # Product images (if applicable)
│   ├── product-slug/   # One folder per product
│   │   ├── black.webp
│   │   ├── navy.webp
│   │   └── gray.webp
├── categories/         # Category header images
├── heroes/             # Hero/banner images
├── articles/           # Article thumbnails
├── advertisements/     # Mock ad creatives
└── logos/              # Site logos
```

## Proven use case: Product color variants

This workflow was used successfully in the retail ecom demo. The key insight is that Nano Banana excels at maintaining consistency across a series — same product, same angle, same lighting — while varying a single attribute like color. This is ideal for:

- Clothing in multiple colors
- Electronics in different finishes
- Furniture in different materials/fabrics
- Vehicles in different colors
- Any product with configurable variants

## Tips

- **Be specific about style consistency**: Reference "matching the style of the previous images" or describe the exact aesthetic in every prompt
- **Generate more than you need**: It's faster to pick the best 3 from a batch than to regenerate
- **Keep prompts for reference**: Save your prompts so you can regenerate or extend the set later
- **Aspect ratios matter**: Specify the aspect ratio in your prompt (e.g., "16:9", "square", "portrait") to reduce cropping later
