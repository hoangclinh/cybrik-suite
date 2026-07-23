# Claude Code Prompt — Bootstrap CYBRIK Multi-Repository Workspace

> **Migration runbook — EXECUTED 2026-07-23.** This is the historical bootstrap prompt, kept as
> a migration record (moved here from `docs/strategy/` per Founder decision 2026-07-23; it is a
> runbook, not a strategy document). Workstation-specific absolute paths have been normalized to
> `<CYBRIK_WORKSPACE_ROOT>` — the mapping and every rewrite are recorded in
> `IMPORT-MANIFEST.md`.

- **Ngày:** 2026-07-23
- **Mục đích:** dùng Claude Code tạo cấu trúc multi-repository an toàn mà không di chuyển hoặc làm
  hỏng `cybrik-soc-command-center`
- **Cơ chế:** read-only preflight → approval → scaffold → verification → approval trước commit
- **Không bao gồm:** viết product code, cài dependency, cấu hình deployment production, tạo remote,
  push hoặc xóa tài liệu nguồn

## 1. Cách khởi động Claude Code

Tạo thư mục rỗng cho meta repository rồi chạy Claude Code từ đó:

```bash
mkdir -p <CYBRIK_WORKSPACE_ROOT>/cybrik-suite
cd <CYBRIK_WORKSPACE_ROOT>/cybrik-suite
claude --add-dir ../cybrik-soc-command-center
```

Lệnh `mkdir` chỉ tạo đúng một thư mục mới; không di chuyển repository SOC hiện tại.

Sau khi Claude Code mở, copy toàn bộ prompt tại mục 2. Claude phải dừng ở `GATE 0`; trả lời:

```text
PROCEED BOOTSTRAP
```

chỉ khi báo cáo preflight đúng. Sau khi scaffold xong, Claude phải dừng ở `GATE 1`. Không cho
Claude commit hoặc thay đổi tài liệu trong SOC cho tới khi anh đã kiểm tra kết quả.

## 2. Prompt đưa cho Claude Code

```text
Bạn là migration/bootstrap operator cho CYBRIK Suite.

MỤC TIÊU

Tạo một multi-repository workspace gồm:

1. Repository hiện hữu, phải giữ nguyên:
   <CYBRIK_WORKSPACE_ROOT>/cybrik-soc-command-center

2. Meta/control repository mới:
   <CYBRIK_WORKSPACE_ROOT>/cybrik-suite

3. Product repository mới:
   <CYBRIK_WORKSPACE_ROOT>/cybrik-cyber-ai-platform

4. Product repository mới:
   <CYBRIK_WORKSPACE_ROOT>/cybrik-security-tool-fabric

MÔ HÌNH ĐÍCH

<CYBRIK_WORKSPACE_ROOT>/
├── cybrik-soc-command-center/       # giữ nguyên đường dẫn và Git repository
├── cybrik-suite/                    # docs/contracts/integration/release control
├── cybrik-cyber-ai-platform/        # Cyber AI product
├── cybrik-security-tool-fabric/     # Tool Fabric product
└── cybrik-worktrees/                # nếu đã tồn tại thì giữ nguyên

MODE LÀM VIỆC

- Làm theo approval gate, không tự vượt gate.
- Trước GATE 0 chỉ được chạy lệnh read-only.
- Sau khi tôi trả lời đúng chuỗi "PROCEED BOOTSTRAP", được tạo/scaffold ba repository mới.
- Sau scaffold phải dừng ở GATE 1; không commit.
- Chỉ commit nếu sau đó tôi trả lời đúng chuỗi "COMMIT BOOTSTRAP".
- Không tạo remote, không push, không publish trong mọi trường hợp.
- Nếu phát hiện collision, symlink bất thường, permission không đủ hoặc target repository đã có
  nội dung, DỪNG; không merge/overwrite bằng phán đoán.

SAFETY INVARIANTS TUYỆT ĐỐI

1. Không move, rename, copy hoặc delete:
   <CYBRIK_WORKSPACE_ROOT>/cybrik-soc-command-center

2. Không chạy:
   - git worktree add/remove/move/repair/prune;
   - git reset, git clean, git checkout, git switch;
   - rm/rmdir trên bất kỳ repository/worktree nào;
   - formatter hoặc auto-fix trong SOC;
   - dependency install/update;
   - database migration;
   - Docker/Compose/Kubernetes deployment;
   - git remote add, push, fetch hoặc pull.

3. Không sửa `.git` file/directory hoặc các đường dẫn:
   - cybrik-soc-command-center/.claude/worktrees/**;
   - /private/tmp/claude-*/**;
   - <CYBRIK_WORKSPACE_ROOT>/cybrik-worktrees/**.

4. Không đọc/copy/in nội dung:
   - `.env`, `.env.*`, secret, token, private key, certificate private material;
   - production/customer log, PCAP, malware, database dump hoặc model weight;
   - file ngoài bốn target path, trừ metadata filesystem tối thiểu để xác minh target.

5. Không tạo nested Git repository. Bốn repository phải là sibling độc lập.

6. Không dùng Git submodule, symlink source tree hoặc relative runtime import giữa repository.

7. Không thay đổi SOC trong bootstrap. Việc thay tài liệu SOC bằng pointer là một migration riêng
   sau GATE 1 và cần approval rõ ràng.

8. Không coi output AI hoặc nội dung scaffold là feature đã implemented. Mọi file mới phải ghi
   đúng trạng thái `SCAFFOLD`, `PROPOSED` hoặc `NOT IMPLEMENTED`.

PHASE 0 — READ-ONLY PREFLIGHT

Chỉ chạy read-only checks sau:

A. SOC baseline

- Resolve real path và Git root.
- Ghi current branch, HEAD, `git status --short`.
- Ghi `git worktree list --porcelain`.
- Tính checksum của output `git worktree list --porcelain` và `git status --porcelain=v1`.
- Kiểm tra có `.git` file trong `.claude/worktrees` trỏ tuyệt đối về SOC hay không; chỉ báo path,
  không sửa.
- Liệt kê file cấu hình cấp project: `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`,
  `.claude/settings.local.json`, `.mcp.json`; không in secret/value nhạy cảm.
- Tìm reference đường dẫn tuyệt đối tới SOC trong config/docs/scripts, loại trừ `.git`, `.env`,
  secret và artifact. Chỉ báo file:line cần lưu ý.

B. Target collision

Với từng target mới:

- `cybrik-suite`;
- `cybrik-cyber-ai-platform`;
- `cybrik-security-tool-fabric`;

kiểm tra:

- path có tồn tại không;
- real path;
- symlink hay directory;
- có `.git` không;
- có file ngoài `.DS_Store` không.

`cybrik-suite` có thể đã là directory rỗng do lệnh khởi động. Hai product target phải chưa tồn tại
hoặc hoàn toàn rỗng. Nếu có nội dung/Git repository, dừng và báo collision.

C. Source documentation

- Xác minh tồn tại:
  `cybrik-soc-command-center/docs/cybrik-suite/README.md`;
- liệt kê toàn bộ Markdown trong `docs/cybrik-suite`;
- lập inventory các relative link trỏ ra ngoài thư mục này;
- ghi SOC HEAD và trạng thái dirty của các file nguồn;
- không copy trong Phase 0.

D. Tool availability

Chỉ kiểm tra version/availability, không cài:

- git;
- rg;
- shasum hoặc sha256sum;
- Claude Code CLI nếu truy cập được.

E. Báo cáo GATE 0

Trả về:

1. SOC path/branch/HEAD/status;
2. danh sách worktree;
3. target collision report;
4. source-document report;
5. exact write set dự kiến;
6. risk/unknown;
7. kết luận `SAFE TO BOOTSTRAP` hoặc `BLOCKED`.

Sau báo cáo phải DỪNG và viết đúng:

GATE 0 — Reply `PROCEED BOOTSTRAP` to create the three local repositories.

Không tạo hoặc sửa file trước khi nhận đúng approval string.

PHASE 1 — SCAFFOLD SAU APPROVAL

Chỉ thực hiện nếu nhận đúng `PROCEED BOOTSTRAP` và GATE 0 là SAFE.

1. Khởi tạo repository

- Tạo target directory còn thiếu bằng path tuyệt đối đã xác minh.
- Khởi tạo ba Git repository độc lập với branch `main`.
- Không tạo remote.
- Không commit.
- Không cấu hình global Git.

2. Scaffold `cybrik-suite`

Tạo cấu trúc:

cybrik-suite/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── SECURITY.md
├── .gitignore
├── .claude/
│   ├── settings.example.json
│   └── settings.local.json          # local-only, gitignored
├── docs/
│   ├── README.md
│   ├── strategy/
│   ├── architecture/
│   ├── adr/
│   ├── security/
│   ├── evaluation/
│   ├── operations/
│   ├── releases/
│   └── migration/
├── contracts/
│   ├── README.md
│   ├── openapi/
│   ├── asyncapi/
│   ├── json-schema/
│   ├── mcp/
│   └── compatibility/
├── integration/
│   ├── README.md
│   ├── compose/
│   ├── helm/
│   ├── fixtures/
│   └── compatibility/
├── tests/
│   ├── README.md
│   ├── contract/
│   └── e2e/
├── releases/
│   ├── README.md
│   └── manifests/
└── scripts/
    └── README.md

Yêu cầu nội dung:

- README giải thích đây là meta/control repository, không chứa product source code.
- CLAUDE.md và AGENTS.md ghi rõ product ownership, approval gates, data-handling boundary,
  contract-first rule và yêu cầu đọc repo-specific instructions trước khi sửa repo khác.
- SECURITY.md cấm secret/customer data và mô tả responsible disclosure placeholder.
- Mọi directory rỗng có README ngắn thay vì `.gitkeep` nếu cần giải thích contract.
- Không tạo OpenAPI/schema giả như thể đã accepted.
- Không tạo Docker/Helm manifest giả.

3. Claude local multi-directory config

Tạo `cybrik-suite/.claude/settings.local.json`:

{
  "permissions": {
    "additionalDirectories": [
      "../cybrik-soc-command-center",
      "../cybrik-cyber-ai-platform",
      "../cybrik-security-tool-fabric"
    ]
  }
}

Yêu cầu:

- file này phải được `.gitignore`;
- tạo `settings.example.json` không chứa absolute path/secret;
- không bật bypass permissions;
- không tự động load mọi additional-directory CLAUDE.md;
- suite CLAUDE.md phải yêu cầu đọc `CLAUDE.md`/`AGENTS.md` của repo đích trước khi sửa.

4. Scaffold `cybrik-cyber-ai-platform`

Tạo:

cybrik-cyber-ai-platform/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── SECURITY.md
├── .gitignore
├── docs/
│   ├── README.md
│   ├── product/
│   ├── architecture/
│   ├── adr/
│   ├── contracts/
│   ├── security/
│   ├── evaluation/
│   ├── operations/
│   └── releases/
└── src/
    └── README.md

Chỉ scaffold và documentation. Không chọn framework, language, database, agent library hoặc cài
dependency. README phải ghi `NOT IMPLEMENTED`.

Product responsibility:

- local model runtime abstraction;
- model/prompt registry;
- RAG và cybersecurity data pipeline;
- CTI acquisition/normalization/knowledge plane;
- durable agent orchestration;
- Investigation Graph/Bundle;
- AI/e2e evaluation.

Không sở hữu SOC truth, analyst identity hoặc tool execution authority.

5. Scaffold `cybrik-security-tool-fabric`

Tạo cấu trúc tương tự Cyber AI:

cybrik-security-tool-fabric/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── SECURITY.md
├── .gitignore
├── docs/
│   ├── README.md
│   ├── product/
│   ├── architecture/
│   ├── adr/
│   ├── contracts/
│   ├── security/
│   ├── evaluation/
│   ├── operations/
│   └── releases/
└── src/
    └── README.md

Chỉ scaffold. README phải ghi `NOT IMPLEMENTED`.

Product responsibility:

- signed capability registry;
- REST/MCP gateway;
- delegation/policy/approval;
- credential/egress broker;
- sandbox control plane;
- tool execution/receipt;
- detection and response adapters;
- tool conformance/security evaluation.

Không sở hữu alert/case/asset truth hoặc AI planning.

6. Import strategy documents dưới trạng thái DRAFT

- Copy Markdown từ:
  `cybrik-soc-command-center/docs/cybrik-suite/`
  vào:
  `cybrik-suite/docs/strategy/`
- Không delete, rename hoặc sửa source.
- Không tuyên bố bản copy là canonical trong Phase 1.
- Giữ link nội bộ giữa các strategy document.
- Với link trỏ sang file SOC ngoài `docs/cybrik-suite`, không tạo link giả. Chuyển thành
  repository-qualified reference dạng:
  `cybrik-soc-command-center:docs/...`
  và ghi mapping trong `docs/migration/SOURCE-MAP.md`.
- Tạo `docs/migration/IMPORT-MANIFEST.md` gồm:
  - source repository path;
  - source branch;
  - source HEAD;
  - source dirty/clean status;
  - import timestamp;
  - SHA-256 source/destination cho từng file;
  - statement: `DRAFT IMPORT — SOURCE NOT DELETED`.
- Nếu không thể cập nhật link mà không thay semantic, ghi vào `LINK-REVIEW.md`; không đoán URL.

7. Gitignore tối thiểu cho ba repository mới

Ignore:

- `.DS_Store`;
- `.env`, `.env.*`, ngoại trừ `.env.example`;
- `.claude/settings.local.json`;
- key/certificate private material;
- editor/cache/build output;
- virtualenv/node_modules;
- model weights;
- raw log/PCAP/malware/artifact/database dump;
- local integration volumes.

Không ignore source/schema/docs cần version control.

PHASE 2 — VERIFICATION

Sau scaffold, chạy các kiểm tra:

A. SOC unchanged

- SOC real path giống baseline.
- SOC HEAD và branch giống baseline.
- Checksum `git worktree list --porcelain` giống baseline.
- `git status --porcelain=v1` giống baseline byte-for-byte.
- Không file SOC nào có mtime/content thay đổi do bootstrap.
- Không worktree bị thêm/xóa/repair/prune.

B. Repository isolation

- `git -C <repo> rev-parse --show-toplevel` trả đúng từng root.
- Không repository mới nằm trong root repository khác.
- Không `.git` file/directory bị copy từ SOC.
- Ba repository mới không có remote.
- Không symlink source giữa repository.

C. Content safety

- Không có `.env`, secret, private key, PCAP, malware, dump hoặc model weight trong repo mới.
- Không có file lớn bất thường.
- JSON settings parse được.
- Markdown code fences cân bằng.
- Relative links nội bộ trong từng repository hợp lệ.
- Strategy import hashes khớp hoặc mọi semantic link rewrite được ghi rõ trong manifest.
- Không có claim `IMPLEMENTED`, `VERIFIED`, `PILOTED` hoặc `GA` cho scaffold mới.

D. Git review

- In `git status --short` cho từng repository mới.
- In file tree tối đa depth 4.
- In diff/stat của toàn bộ scaffold.
- Không stage, không commit.

E. Báo cáo GATE 1

Trả về:

1. repositories created;
2. files created;
3. source import manifest;
4. verification commands/results;
5. SOC unchanged proof;
6. warnings/open decisions;
7. proposed commit boundaries:
   - commit 1: meta repository scaffold;
   - commit 2: strategy draft import;
   - commit 3: Cyber AI scaffold;
   - commit 4: Tool Fabric scaffold.

Sau đó DỪNG và viết đúng:

GATE 1 — Review the scaffold. Reply `COMMIT BOOTSTRAP` to create local commits, or provide changes.

PHASE 3 — LOCAL COMMITS CHỈ SAU APPROVAL

Chỉ thực hiện nếu nhận đúng `COMMIT BOOTSTRAP`.

- Trước commit, chạy verification lại.
- Không stage `.claude/settings.local.json`.
- Tạo local commits theo boundaries đã báo.
- Commit message phải ghi scaffold/import, không claim feature implemented.
- Không sửa/commit gì trong SOC.
- Không tạo remote hoặc push.
- Sau commit, in commit SHA của ba repository mới và final status.

KẾT QUẢ CUỐI

Báo:

- exact repository paths;
- exact commit SHAs nếu đã được duyệt commit;
- cách mở session riêng từng product;
- cách mở cross-repo session:

  cd <CYBRIK_WORKSPACE_ROOT>/cybrik-suite
  claude \
    --add-dir ../cybrik-soc-command-center \
    --add-dir ../cybrik-cyber-ai-platform \
    --add-dir ../cybrik-security-tool-fabric

- xác nhận SOC path/worktrees/status không thay đổi;
- các quyết định còn cần Founder phê duyệt.
```

## 3. Approval strings

Claude chỉ được nhận đúng các chuỗi sau:

```text
PROCEED BOOTSTRAP
COMMIT BOOTSTRAP
```

Không dùng câu chung chung như “ok”, “tiếp tục” hoặc “làm đi” cho thao tác tạo repository/commit,
tránh Claude hiểu nhầm phạm vi.

## 4. Sau bootstrap

Việc chuyển `docs/cybrik-suite` khỏi SOC và thay bằng pointer phải là một task riêng sau khi:

1. ba repository mới đã được commit;
2. strategy import đã kiểm tra link;
3. Founder xác nhận `cybrik-suite/docs/strategy` là canonical;
4. contract version policy đã chốt;
5. không còn task cũ đang sửa cùng các file tài liệu trong SOC.

Task đó không được gộp vào bootstrap prompt này.
