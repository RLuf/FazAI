# CLAUDE.md

> Think carefully and implement the most concise solution that changes as little code as possible.

## 🚨 AGENT USAGE - MANDATORY

**CRITICAL: You MUST use specialized agents for ALL non-trivial tasks.**

See: `.claude/rules/agent-mandatory.md` for complete enforcement rules.

### Quick Reference - When to Use Agents:

| Task Type | Agent | Example |
|-----------|-------|---------|
| Python code | `python-backend-engineer` | Build FastAPI endpoint |
| React/UI | `react-frontend-engineer` | Create dashboard component |
| Testing | `test-runner` | Run test suite |
| Database | `postgresql-expert`, `mongodb-expert` | Design schema |
| DevOps | `kubernetes-orchestrator`, `docker-containerization-expert` | Deploy app |
| Code review | `code-analyzer` | Find bugs/security issues |
| Large files | `file-analyzer` | Parse logs >1000 lines |

**Before doing ANY complex task**: Check if there's a specialized agent. If YES → USE IT!

## Active Team Agents

<!-- AGENTS_START -->
<!-- AGENTS_END -->

## 🐳 DOCKER-FIRST DEVELOPMENT WORKFLOW

This project enforces Docker-first development to ensure consistency and reproducibility across all environments.

### 🚨 CRITICAL RULE: NO LOCAL EXECUTION

**All code must run inside Docker containers.** Local execution outside containers is blocked.

### 🔧 Docker Development Environment

#### Required Commands
- All development happens in Docker containers
- Use `docker compose` for orchestration
- Hot reload enabled for rapid development

#### Getting Started

1. **Start development environment**
   ```bash
   docker compose up -d
   ```

2. **Run commands in containers**
   ```bash
   # Commands depend on your project type:
   # Node.js: docker compose exec app npm install
   # Python: docker compose exec app pip install -r requirements.txt
   # Go: docker compose exec app go mod download
   # Ruby: docker compose exec app bundle install
   # PHP: docker compose exec app composer install

   # Development and testing commands will be project-specific
   ```

3. **View logs**
   ```bash
   docker compose logs -f app
   ```

### 📋 Docker-First Rules

- **NEVER** run `npm install` directly on host
- **NEVER** execute code outside containers
- **ALWAYS** use `docker compose exec` for commands
- **ALWAYS** define services in docker-compose.yml

### 🔥 Hot Reload Configuration

Development containers are configured with:
- Volume mounts for source code
- File watchers for automatic reload
- Debug ports exposed
- Database containers for local development

### ⚠️ Enforcement

If you attempt local execution, you'll see:
```
❌ Docker-first development enforced
Use: docker compose exec app <command>
```

## CRITICAL RULE FILES

All rule files in `.claude/rules/` define mandatory behaviors and must be followed:

### 🚨 HIGHEST PRIORITY Rules

- **agent-mandatory.md** - MANDATORY agent usage for all non-trivial tasks. READ THIS FIRST!
- **tdd.enforcement.md** - Test-Driven Development cycle (RED-GREEN-REFACTOR)
- **pipeline-mandatory.md** - Required pipelines for errors, features, bugs, code search, and log analysis

### Core Development Rules

- **naming-conventions.md** - Naming standards, code quality requirements, and prohibited patterns
- **context-optimization.md** - Agent usage patterns for context preservation (<20% data return)
- **development-workflow.md** - Development patterns, search-before-create, and best practices
- **command-pipelines.md** - Command sequences, prerequisites, and PM system workflows

### Operational Rules

- **agent-coordination.md** - Multi-agent parallel work with file-level coordination
- **agent-coordination-extended.md** - Extended coordination patterns for complex workflows
- **git-strategy.md** - Unified Git branch strategy, naming conventions, and merge workflows
- **datetime.md** - Real datetime requirements using ISO 8601 UTC format (no placeholders)
- **frontmatter-operations.md** - YAML frontmatter standards for PRDs, epics, and tasks
- **strip-frontmatter.md** - Metadata removal for GitHub sync and external communication
- **github-operations.md** - GitHub CLI safety and critical template repository protection
- **no-pr-workflow.md** - Direct main branch development without PRs

### Technical Rules

- **test-execution.md** - Testing standards requiring test-runner agent, no mocks, real services only
- **standard-patterns.md** - Command consistency, fail-fast philosophy, and minimal validation
- **use-ast-grep.md** - Structural code search using AST over regex for language-aware patterns
- **database-pipeline.md** - Database migrations, query optimization, and backup procedures
- **infrastructure-pipeline.md** - IaC deployments, container builds, and cloud operations

### Code Formatting & Quality

**MANDATORY**: All code MUST pass autoformatters and linters before commit:

- **Python**: Must pass `black` formatter and `ruff` linter
- **JavaScript/TypeScript**: Must pass `prettier` and `eslint`
- **Markdown**: Must pass `markdownlint`
- **Other languages**: Use language-specific standard tools

Always run formatters and linters BEFORE marking any task as complete.

## DOCUMENTATION REFERENCES

### Agent Documentation (`.claude/agents/`)

**📋 Complete Agent Registry**: See `.claude/agents/AGENT-REGISTRY.md` for comprehensive list of all available agents with descriptions, tools, and direct links.

Agents are organized by category for better maintainability:

- **Core Agents** (`.claude/agents/core/`) - Essential agents for all projects
- **Language Agents** (`.claude/agents/languages/`) - Language-specific experts
- **Framework Agents** (`.claude/agents/frameworks/`) - Framework and UI specialists
- **Cloud Agents** (`.claude/agents/cloud/`) - Cloud platform architects
- **DevOps Agents** (`.claude/agents/devops/`) - CI/CD and operations
- **Database Agents** (`.claude/agents/databases/`) - Database specialists
- **Data Agents** (`.claude/agents/data/`) - Data engineering

### Command Documentation (`.claude/commands/`)

- Custom commands and patterns documented in `.claude/commands/`
- **Azure DevOps Commands** (`.claude/commands/azure/`) - Complete Azure DevOps integration
- **PM Commands** (`.claude/commands/pm/`) - Project management workflow

## USE SUB-AGENTS FOR CONTEXT OPTIMIZATION

### Core Agents (Always Available)

#### file-analyzer - File and log analysis
Always use for reading and summarizing files, especially logs and verbose outputs.

#### code-analyzer - Bug hunting and logic tracing
Use for code analysis, bug detection, and tracing execution paths.

#### test-runner - Test execution and analysis
Use for running tests and analyzing results with structured reports.

#### parallel-worker - Multi-stream parallel execution
Use for coordinating multiple work streams in parallel.

## AGENT SELECTION GUIDANCE

Use Docker-aware agents for containerized development:

### Docker Specialists (PRIMARY)

#### docker-containerization-expert
**Use for**: Dockerfile optimization, multi-stage builds, security
- Container best practices
- Image size optimization
- Security scanning
- Registry management

#### docker-containerization-expert
**Use for**: Multi-container orchestration, service dependencies
- Development environment setup
- Service networking
- Volume management
- Environment configuration

#### docker-containerization-expert
**Use for**: Development workflows, hot reload setup
- Volume mounting strategies
- Development vs production configs
- CI/CD integration
- Container debugging

### Language Agents (Docker-Aware)

#### python-backend-engineer
- FastAPI/Flask in containers
- Dockerfile best practices for Python
- pip-tools for reproducible builds
- Multi-stage builds for production

#### nodejs-backend-engineer
- Node.js containerization
- npm ci for consistent installs
- Layer caching optimization
- Development vs production images

### Framework Agents (Container Context)

#### react-frontend-engineer
- React apps in containers
- Nginx serving for production
- Build optimization in Docker
- Environment variable injection

#### python-backend-engineer
- Async Python in containers
- Uvicorn/Gunicorn configuration
- Health check endpoints
- Container-native logging

### Database Agents (Containerized)

#### postgresql-expert
- PostgreSQL in Docker
- Data persistence with volumes
- Backup strategies for containers
- Connection pooling in containerized environments

#### redis-expert
- Redis caching in containers
- Persistent volumes setup
- Cluster configuration
- Container networking

### DevOps Agents

#### github-operations-specialist
- Docker build in GitHub Actions
- Container registry management
- Multi-arch image builds
- Security scanning in CI/CD

---

**📋 Full Agent Details**: For complete agent descriptions, parameters, tools, and file locations, see `.claude/agents/AGENT-REGISTRY.md`

## Project Management

This project uses local development workflow without CI/CD automation.

### Development Workflow

1. **Local Development**
   - Make changes locally
   - Run tests manually
   - Commit when ready

2. **Manual Testing**
   - Test changes locally before committing
   - Use project-specific test commands
   - Verify functionality manually

3. **Deployment**
   - Deploy manually as needed
   - Follow project-specific deployment procedures
   - Coordinate with team for releases

### Version Control
```bash
# Standard git workflow
git add .
git commit -m "Your message"
git push origin main
```

Focus on code quality and manual verification before commits.

## TDD PIPELINE FOR ALL IMPLEMENTATIONS

### Mandatory Test-Driven Development Cycle

Every implementation MUST follow:

1. **RED Phase**: Write failing test first
   - Test must describe desired behavior
   - Test MUST fail initially
   - Test must be meaningful (no trivial assertions)

2. **GREEN Phase**: Make test pass
   - Write MINIMUM code to pass test
   - Don't add features not required by test
   - Focus on making test green, not perfection

3. **REFACTOR Phase**: Improve code
   - Improve structure while tests stay green
   - Remove duplication
   - Enhance readability

## CONTEXT OPTIMIZATION RULES

See **`.claude/rules/context-optimization.md`** for detailed context preservation patterns and agent usage requirements.

## ERROR HANDLING PIPELINE

See **`.claude/rules/development-workflow.md`** for complete error handling and development pipelines.

## WHY THESE RULES EXIST

### Development Quality

- **No partial implementations** → Technical debt compounds exponentially
- **No mock services in tests** → Real bugs hide behind mocks
- **TDD mandatory** → Prevents regression and ensures coverage

### Context Preservation

- **Agent-first search** → Preserves main thread for decisions
- **No verbose outputs** → Maintains conversation clarity
- **10-20% return rule** → Focuses on actionable insights

### Code Integrity

- **No "_fixed" suffixes** → Indicates poor planning
- **No orphan docs** → Documentation should be intentional
- **No mixed concerns** → Maintainability over convenience

## Philosophy

### Error Handling

- **Fail fast** for critical configuration (missing text model)
- **Log and continue** for optional features (extraction model)
- **Graceful degradation** when external services unavailable
- **User-friendly messages** through resilience layer

### Testing

See **`.claude/rules/test-execution.md`** for testing standards and requirements.

## Tone and Behavior

- Criticism is welcome. Please tell me when I am wrong or mistaken, or even when you think I might be wrong or mistaken.
- Please tell me if there is a better approach than the one I am taking.
- Please tell me if there is a relevant standard or convention that I appear to be unaware of.
- Be skeptical.
- Be concise.
- Short summaries are OK, but don't give an extended breakdown unless we are working through the details of a plan.
- Do not flatter, and do not give compliments unless I am specifically asking for your judgement.
- Occasional pleasantries are fine.
- Feel free to ask many questions. If you are in doubt of my intent, don't guess. Ask.

## ABSOLUTE RULES

See **`.claude/rules/naming-conventions.md`** for code quality standards and prohibited patterns.

Key principles:

- NO PARTIAL IMPLEMENTATION
- NO CODE DUPLICATION (always search first)
- IMPLEMENT TEST FOR EVERY FUNCTION (see `.claude/rules/tdd.enforcement.md`)
- NO CHEATER TESTS (tests must be meaningful)
- Follow all rules defined in `.claude/rules/` without exception

## 📋 Quick Reference Checklists

### Before Committing

```bash
# Minimum Definition of Done
✓ Tests written and passing (TDD - see .claude/rules/tdd.enforcement.md)
✓ Code formatted (black, prettier, eslint)
✓ No partial implementations
✓ No code duplication
✓ Error handling implemented
✓ Security considered

# Run project-appropriate checks (automated with git hooks)
# Test: npm test | pytest | go test | cargo test | mvn test
# Lint: npm run lint | ruff check | golint | cargo clippy | rubocop
# Build: npm run build | python setup.py build | go build | cargo build
# Type check: npm run typecheck | mypy | go vet

# Or use safe-commit script for all checks
./scripts/safe-commit.sh "feat: your message"

# Simulate CI locally before push (if available)
# Check package.json, Makefile, or project docs for CI simulation commands
```

### Before Creating PR

```bash
✓ Branch up to date with main
✓ All tests passing
✓ CI/CD pipeline green
✓ Documentation updated
✓ Breaking changes noted
```

### Code Quality Checklist

```bash
✓ Functions are single-purpose
✓ Variable names are descriptive
✓ No hardcoded values
✓ No debugging code left
✓ Comments explain "why" not "what"
```

For detailed checklists, see `.claude/checklists/`

## AGENT SELECTION GUIDANCE

Use specialized agents for Docker + Kubernetes workflows:

### Kubernetes Specialists (PRIMARY)

#### kubernetes-orchestrator
**Use for**: K8s manifests, deployments, services
- Deployment strategies
- Service mesh configuration
- Ingress and networking
- RBAC and security policies

#### terraform-infrastructure-expert
**Use for**: Infrastructure as Code
- Multi-cloud deployments
- State management
- Module development
- GitOps workflows

### Container Specialists

#### docker-containerization-expert
**Use for**: Production-grade images
- Multi-stage builds
- Security hardening
- Base image selection
- Layer optimization

#### docker-containerization-expert
**Use for**: Local development orchestration
- Development parity with K8s
- Service dependencies
- Local testing environments

### Cloud Platform Specialists

#### gcp-cloud-architect
**Use for**: GKE deployments
- GKE cluster configuration
- Cloud Build pipelines
- Artifact Registry
- Workload Identity

#### aws-cloud-architect
**Use for**: EKS deployments
- EKS cluster setup
- ECR registry
- IAM roles for service accounts
- ALB ingress controller

#### azure-cloud-architect
**Use for**: AKS deployments
- AKS cluster management
- Azure Container Registry
- Azure AD integration
- Application Gateway ingress

### DevOps & CI/CD Agents

#### github-operations-specialist
**Use for**: GitHub Actions pipelines
- KIND cluster testing
- Multi-environment deployments
- Helm chart automation
- GitOps with ArgoCD

#### azure-devops-specialist
**Use for**: Enterprise pipelines
- Azure Pipelines for K8s
- Multi-stage deployments
- Approval gates
- Integration with AKS

### Monitoring & Observability

#### prometheus-grafana-expert (implied)
- Metrics collection
- Dashboard creation
- Alert configuration
- SLO/SLI tracking

### Security Agents

#### security-scanning-expert (implied)
- Container vulnerability scanning
- SAST/DAST in pipelines
- Policy as code
- Compliance validation

---

**📋 Full Agent Details**: For complete agent descriptions, parameters, tools, and file locations, see `.claude/agents/AGENT-REGISTRY.md`

## 🚀 FULL DEVOPS WORKFLOW (DOCKER + KUBERNETES)

This project uses a hybrid strategy: Docker for local development, Kubernetes for CI/CD and production.

### 🎯 HYBRID STRATEGY

#### Why Hybrid?
**The Problem**: 
- ✅ Docker works perfectly for local development
- ❌ CI/CD runners use containerd (no Docker daemon)
- ❌ `docker build` and `docker run` fail in Kubernetes runners

**The Solution**:
- 🏠 **Local**: Pure Docker (unchanged for developers)
- ☸️ **CI/CD**: Kubernetes-native using Kaniko for builds
- 🐳 **Shared**: Dockerfiles remain source of truth

#### Local Development: Docker-First
- All local development happens in Docker containers
- Use `docker compose` for service orchestration
- Hot reload enabled for rapid iteration

#### CI/CD & Production: Kubernetes-Native
- GitHub Actions automatically test in KIND clusters
- Kaniko builds images without Docker daemon
- Helm charts for production deployments
- Multi-environment support (dev/staging/prod)

### 🐳 Local Development (Docker)

1. **Start development environment**
   ```bash
   docker compose up -d
   ```

2. **Run commands in containers**
   ```bash
   # Commands depend on your project type:
   # Node.js: docker compose exec app npm install
   # Python: docker compose exec app pip install -r requirements.txt
   # Go: docker compose exec app go mod download
   # Ruby: docker compose exec app bundle install
   # PHP: docker compose exec app composer install
   ```

3. **Simulate CI locally before push**
   ```bash
   # Test commands depend on project type:
   # Node.js: npm ci && npm run build && npm test
   # Python: pip install . && pytest && ruff check
   # Go: go test ./... && go build
   # Ruby: bundle exec rspec && rubocop

   # Check for project-specific CI scripts in:
   # - package.json scripts
   # - Makefile targets
   # - .github/workflows/
   ```

### ☸️ Kubernetes Testing (CI/CD)

Automated via GitHub Actions:

1. **KIND Cluster Setup**
   - Spins up Kubernetes in Docker
   - Tests deployment manifests
   - Validates Helm charts

2. **Building Images with Kaniko**
   ```yaml
   # In GitHub Actions (no Docker daemon)
   - name: Build with Kaniko
     run: |
       kubectl apply -f - <<EOF
       apiVersion: batch/v1
       kind: Job
       metadata:
         name: kaniko-build
       spec:
         template:
           spec:
             containers:
             - name: kaniko
               image: gcr.io/kaniko-project/executor:latest
               args:
                 - "--dockerfile=Dockerfile"
                 - "--context=git://github.com/user/repo"
                 - "--destination=registry/image:tag"
       EOF
   ```

3. **Integration Tests**
   ```yaml
   # Runs automatically on push
   - Tests in real K8s environment
   - Multi-version K8s testing
   - Security scanning with Trivy
   ```

4. **Production Deployment**
   ```bash
   # Helm deployment (automated)
   helm upgrade --install app ./charts/app
   ```

### 📋 DevOps Rules

#### Local Development
- **ALWAYS** use Docker Compose locally
- **NEVER** run code on host machine
- **MAINTAIN** hot reload for productivity

#### CI/CD Pipeline
- **AUTOMATE** K8s testing in GitHub Actions
- **VALIDATE** manifests before deployment
- **SCAN** images for vulnerabilities

#### Production
- **DEPLOY** via Helm charts
- **MONITOR** with Prometheus/Grafana
- **SCALE** based on metrics

### 🔧 Required Files

```
project/
├── docker-compose.yml      # Local development
├── Dockerfile             # Container build
├── k8s/                   # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── charts/                # Helm charts
│   └── app/
│       ├── Chart.yaml
│       └── values.yaml
└── .github/workflows/     # CI/CD pipelines
    └── kubernetes-tests.yml
```

### ⚠️ Important Notes

- Local Docker ≠ Production Kubernetes
- Test in KIND before production
- Use namespaces for isolation
- Enable resource limits
- Implement health checks