---
name: create-skill
description: Create Gemini CLI agent skills. Use when users want to create, update, or package skills that extend Gemini CLI's capabilities with specialized knowledge, workflows, or tool integrations.
---

# Create Gemini CLI Skill

You are an expert in creating Gemini CLI agent skills. Use this skill when users want to:
- Create a new skill from scratch
- Update or modify existing skills
- Package and distribute skills
- Understand skill anatomy and best practices

## Skill Anatomy

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Node.js/Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else Gemini CLI needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Gemini CLI is already very smart.** Only add context Gemini CLI doesn't already have. Challenge each piece of information: "Does Gemini CLI really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

- **High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.
- **Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.
- **Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

## Skill Creation Process

### Step 1: Understand the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood.

To create an effective skill, clearly understand concrete examples of how the skill will be used:
- "What functionality should the skill support?"
- "Can you give some examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"

### Step 2: Plan the Reusable Skill Contents

To turn concrete examples into an effective skill, analyze each example by:
1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful

### Step 3: Create the Skill Directory

Create the skill directory with the following structure:

```bash
mkdir -p skill-name
mkdir -p skill-name/scripts
mkdir -p skill-name/references
mkdir -p skill-name/assets
```

### Step 4: Write SKILL.md

#### Frontmatter (Required)

```yaml
---
name: skill-name
description: >
  A clear description of what the skill does and when to use it.
  This is the primary triggering mechanism for your skill.
---
```

**Important**: The description should:
- Be a single-line string
- Include both what the Skill does AND specific triggers/contexts
- Include all "when to use" information here - not in the body

**Example**:
```yaml
---
name: security-audit
description: Expertise in auditing code for security vulnerabilities. Use when the user asks to "check for security issues" or "audit" their changes.
---
```

#### Body

Write instructions for using the skill and its bundled resources. Keep it concise and focused.

### Step 5: Add Bundled Resources (Optional)

#### Scripts (`scripts/`)

Executable code for tasks that require deterministic reliability:
- When the same code is being rewritten repeatedly
- When deterministic reliability is needed
- Must output LLM-friendly stdout

#### References (`references/`)

Documentation loaded as needed into context:
- Database schemas
- API documentation
- Domain knowledge
- Company policies

**Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md

#### Assets (`assets/`)

Files used in the final output:
- Templates
- Images
- Boilerplate code

## Progressive Disclosure Design

Skills use a three-level loading system:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed (Unlimited)

**Pattern 1: High-level guide with references**
```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber: [code example]

## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md)
- **API reference**: See [REFERENCE.md](REFERENCE.md)
```

**Pattern 2: Domain-specific organization**
```
bigquery-skill/
├── SKILL.md
└── reference/
    ├── finance.md
    ├── sales.md
    └── product.md
```

## Skill Naming

- Use lowercase letters, digits, and hyphens only
- Maximum 64 characters
- Prefer short, verb-led phrases
- Namespace by tool when it improves clarity (e.g., `gh-address-comments`)

## What NOT to Include

A skill should only contain essential files. Do NOT create:
- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md

## Testing the Skill

1. Place the skill in `.agents/skills/` directory
2. Restart the CLI session
3. Use `/skills list` to verify the skill is loaded
4. Trigger the skill with appropriate prompts

## Distribution

To distribute a skill:
1. Package the skill folder
2. Share via GitHub or other repositories
3. Users can install via `gemini skills install <path>`

## Reference: Gemini CLI Skill Examples

Example skill locations in this project:
- `.gemini/skills/docs-writer/` - Documentation writing skill
- `.gemini/skills/skill-creator/` - Built-in skill creator

## Key Documentation

- Full guide: `docs/cli/creating-skills.md`
- Skills reference: `docs/cli/skills.md`
- Extension best practices: `docs/extensions/best-practices.md`
