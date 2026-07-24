# Vietnamese Government & Cybersecurity Coordination — Evidence Base

- Status: evidence base (informs the model; decides nothing by itself). The model it informs is
  `ACCEPTED` at W2-C1, but this evidence is **not** ratified as fact: the `[UNKNOWN]` /
  secondary-sourced legal/authority claims remain **open** and gate only jurisdiction-specific
  operational reliance (see §7 honesty flags).
- Packet: [Organizational hierarchy & external-authority boundary](README.md)
- Date: 2026-07-24
- Gate: W2-C0 (research/evidence); unknowns carried forward past W2-C1
- Method: public open-source research via web search of official portals, primary legal texts
  (where retrievable), and reputable secondary analyses. No non-public system was accessed.
- Evidence tags: **[CONFIRMED]** = backed by a cited source (URL + access date) · **[INFERRED]**
  = reasoned deduction with stated basis · **[UNKNOWN]** = could not verify.

> **Honesty & durability note.** This document does **not** invent exact legal authorities,
> article numbers, unit codes, or reporting lines. Where statute-level precision was needed and
> could not be verified against a primary source, it is marked **[UNKNOWN]**. Several load-bearing
> claims rest on secondary sources; confirm against the official gazette before treating any
> specific legal duty as settled. The Vietnamese structure is used as the *motivating reference*
> for a **portable** model — the product hard-codes none of it (see
> [02-domain-model.md](02-domain-model.md)).

---

## 0. Time-sensitivity warning (read first)

Vietnam executed two sweeping 2025 reorganizations that directly bear on this topic. Any
2024-era org map is already stale — which is the central architectural reason to model tiers and
authorities as **configuration, not constants**:

- **[CONFIRMED]** A **police/administrative restructuring removed the district tier** — police
  effective ~1 March 2025; civil administration effective 1 July 2025. (Sources 9, 10, 11, 12)
- **[CONFIRMED]** The **Ministry of Information and Communications (MIC) was merged into the
  Ministry of Science and Technology (MoST)**, effective 1 March 2025; the civilian
  information-security bodies (AIS, VNCERT/CC, NCSC) moved under MoST. (Sources 6, 13, 14)
- **[CONFIRMED — pending primary verification]** A reported **amended/unified Cybersecurity Law
  consolidating the 2018 Law on Cybersecurity and the 2015 Law on Network Information Security**
  was reportedly passed on 10 December 2025 (secondary source only; the primary consolidated
  text and its duty-allocation are **[UNKNOWN]** here). (Source 14)

---

## 1. A05 identity

- **[CONFIRMED]** "A05" designates **Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ
  cao** (Department/Bureau of Cybersecurity and High-Tech Crime Prevention), a *cục*
  (department/bureau) **directly under the Ministry of Public Security (MPS / Bộ Công an)**.
  Formed **10 August 2018** by merging the former Cyber Security Bureau (Cục An ninh mạng, est.
  2014) with the High-Tech Crime Police (C50, est. 2010). (Sources 1, 2)
- **[CONFIRMED]** Mandate: lead national agency for cybersecurity/network safety and for
  preventing, detecting, investigating, and handling high-tech crime; also a designated
  specialized agency for personal-data protection on MPS's behalf. (Sources 1, 2)
- **[CONFIRMED]** Under the 2018 Law on Cybersecurity, the MPS cybersecurity force (operationally
  A05) exercises **coercive state authority** — it can compel service providers to verify user
  data, retain logs, and block/remove content on official request (commonly cited compliance
  windows). (Sources 3, 4, 5)
- **Why an external SOC/security product must treat an A05 connection as an *upper/external*
  trust boundary, not an internal tier:**
  - **[INFERRED]** A05 is a **sovereign law-enforcement / national-security authority**, not a
    customer-internal SOC role. A connection crosses an organizational *and* legal boundary:
    requests carry state compulsion and data flowing to it may become evidence. Basis: its
    statutory coercive powers plus its status as a national MPS department, not a tenant sub-unit.
  - **[INFERRED]** Trust is asymmetric. The tenant does not *manage* A05 and cannot grant or
    revoke its authority; interaction is **gated, audited data exchange across a jurisdictional
    edge** — an external liaison endpoint, not a node in the tenant's own org tree.
- **Distinctions / cautions:**
  - **[INFERRED / partly UNKNOWN]** MPS unit prefixes broadly split "**A**" = *An ninh*
    (national-security side, where A05 sits) vs "**C**" = *Cảnh sát* (police/criminal side).
    Public lists map the population-database/administrative-management bureau to **C06**. The
    identity of a unit labeled **"A06" is [UNKNOWN]** in reliable sources — **do not hard-code it.**
  - **[CONFIRMED]** A05/MPS is **distinct** from the MIC-lineage civilian bodies (VNCERT/CC, AIS,
    NCSC), which handle incident-response coordination and information-security (an toàn thông
    tin) monitoring rather than national-security policing/investigation. (Sources 6, 7, 8)

---

## 2. National cyber coordination bodies

- **[CONFIRMED]** Vietnam historically runs a **dual-track** model:
  - **MPS (Bộ Công an) → A05:** "an ninh mạng" (cybersecurity as national security), law
    enforcement, high-tech crime, personal-data-protection enforcement, critical-infrastructure
    protection from a security angle. Legal anchor: **2018 Law on Cybersecurity** (effective
    1 Jan 2019) + **Decree 53/2022/NĐ-CP**. (Sources 3, 4, 5)
  - **Civilian information-security track (formerly MIC):** **AIS** (policy/technical measures),
    **VNCERT/CC** (nationwide incident-response coordination; national/international CERT
    liaison), **NCSC** (central monitoring/early-warning). Legal anchor: **2015 Law on Network
    Information Security** (an toàn thông tin). (Sources 6, 7, 8, 15)
- **[CONFIRMED]** 2025 change: MIC merged into MoST (1 March 2025); AIS/VNCERT/NCSC functions
  moved under MoST. (Sources 6, 13, 14)
- **[CONFIRMED — pending primary verification]** Reported 10 December 2025 amended/unified
  Cybersecurity Law consolidating the 2018 and 2015 laws; primary text and duty-allocation
  **[UNKNOWN]** here. (Source 14)
- **Incident-reporting destinations (coarse):**
  - **[INFERRED]** A **two-channel** obligation: (1) info-security incidents → the CERT/
    coordination track (VNCERT/CC / NCSC) for technical response; (2) matters touching national
    security, high-tech crime, or important national-security information systems → **MPS / A05**.
    Basis: the dual statutory regime + VNCERT's national-coordination role + MPS's
    critical-infrastructure mandate.
  - **[UNKNOWN]** Exact reporting thresholds, timelines, and which systems route to which
    authority are decree/circular-driven and were not fully verified → the product must make
    destination authority and trigger conditions **configurable**.

---

## 3. Administrative tier structure

- **[CONFIRMED — legacy, pre-2025]** Civil administration was a **4-level** hierarchy:
  **Central → Provincial (tỉnh/thành phố) → District (huyện/quận) → Commune (xã/phường)**.
  Public-security organs (Công an) were generally **mirrored** across these tiers. (Source 9)
- **[CONFIRMED — 2025 reform]** The **district level was abolished**, moving to **two-tier local
  government** (province + commune). Provinces consolidated **63 → 34**; ~two-thirds of
  communes/wards dissolved; civil-administration reform effective 1 July 2025. (Sources 10, 11, 12)
- **[CONFIRMED — police specifically]** MPS restructured from **4 levels to 3**:
  **Ministry → Provincial → Commune** — not organizing district-level police; ~694 district
  police agencies ceased operation. Effective ~1 March 2025. (Source 9)
- **[INFERRED — modeling takeaway]** Tier count is **jurisdiction- and time-dependent** (4
  before 2025, 3 after). The product must support a **configurable 3–4 tier** hierarchy rather
  than encoding "district" as a permanent level. Specialized central bureaus like A05 sit
  **outside** the geographic tier ladder (functional national departments) — an argument for
  separating "geographic tier" from "authority/liaison" as distinct model concepts.
- **[UNKNOWN]** Whether A05 maintains formally mirrored provincial/commune cyber sub-units after
  the 2025 reform, and the exact post-reform reporting lines between provincial cyber police and
  A05 — **not verified; do not assert a specific chain.**

---

## 4. Portability check (keeps the product model international)

- **[INFERRED]** The pattern generalizes cleanly:
  - **US:** federal (CISA, FBI/IC3) · state (state police / fusion centers, state CISOs) · local
    (county/municipal). A tenant SOC connecting to CISA or an FBI field office is an **external
    authority liaison**, structurally identical to the A05 case.
  - **EU:** national CSIRTs/competent authorities under **NIS2**, coordinated via ENISA/CSIRTs
    Network; operators report to a designated national authority — an external, gated reporting
    relationship.
  - **General shape:** every jurisdiction has (1) a **geographic administrative hierarchy** of
    variable depth and (2) one or more **national/sectoral authorities** reachable via mandated,
    boundaried reporting/data-exchange. Modeling these as two orthogonal, configurable concepts
    keeps the product portable.

---

## 5. Modeling implications (carried into the domain model)

These are the load-bearing takeaways; the domain model ([02](02-domain-model.md)) implements
them as invariants INV-1 / INV-2 and the tenant↔org_node separation.

- **[INFERRED]** Model **two orthogonal concepts**: an internal **geographic/org hierarchy**
  (tenant-owned tree) and **external authority connections** (federated liaison endpoints). A05
  is the latter, never a node in the former.
- **[INFERRED]** Make **tier count and names configurable (3–4+)**; do not encode
  district/commune/province as fixed levels — Vietnam's own count changed in 2025.
- **[INFERRED]** An "external trust boundary" means **gated, logged data *exchange***, not
  org-tree membership and not directory/identity federation of the authority into the tenant.
- **[INFERRED]** **Hierarchy must not imply raw-data access** — a parent tier or upper authority
  must not automatically inherit read access; access is a separate, explicit, minimized,
  purpose-bound grant.
- **[INFERRED]** A **national-authority connection must never be an automatic super-admin** —
  external authorities get scoped, request-driven, audited interfaces; legal compulsion is a
  governed workflow, not a standing platform privilege.
- **[INFERRED]** Treat authority-bound outbound data as potentially **evidentiary**: audit,
  integrity/chain-of-custody, and data-minimization on anything crossing to an A05-class endpoint.
- **[INFERRED]** Make **destination authority, trigger conditions, and reporting timelines
  configurable per jurisdiction** (dual-track: CERT/technical vs security/law-enforcement).
- **[INFERRED]** Design for **reorg churn** (MIC→MoST 2025; A05 itself a 2018 merger): reference
  authorities by stable internal IDs with editable display metadata, not hard-coded names/codes.

---

## 6. Source table

| # | Title | URL | Access date | Type |
|---|-------|-----|-------------|------|
| 1 | Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao (Wikipedia VI) | https://vi.wikipedia.org/wiki/Cục_An_ninh_mạng_và_phòng,_chống_tội_phạm_sử_dụng_công_nghệ_cao | 2026-07-24 | Secondary |
| 2 | A05 (merger of C50 + Cyber Security Bureau) — Thư Viện Pháp Luật | https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/tu-van-phap-luat/56420/ | 2026-07-24 | Secondary (legal portal) |
| 3 | Law on Cyber Security 2018 (English PDF, unofficial translation) | https://www.economica.vn/Content/files/LAW%20&%20REG/Law%20on%20Cyber%20Security%202018.pdf | 2026-07-24 | Primary (law text) |
| 4 | Decree 53 guidance on Vietnam's Cybersecurity Law — Tilleke & Gibbins | https://www.tilleke.com/insights/decree-53-provides-long-awaited-guidance-on-implementation-of-vietnams-cybersecurity-law/ | 2026-07-24 | Secondary (law firm) |
| 5 | Decree 53 analysis — Mondaq | https://www.mondaq.com/security/1223282/ | 2026-07-24 | Secondary (law firm) |
| 6 | Cybersecurity Emergency Response Center established (VNCERT/CC) — MoST English | https://english.mst.gov.vn/cybersecurity-emergency-response-center-established-197139865.htm | 2026-07-24 | Official (gov, MoST) |
| 7 | Cybersecurity Emergency Response Center established — VNISA | https://vnisa.org.vn/en/cybersecurity-emergency-response-center-established/ | 2026-07-24 | Secondary (industry assoc.) |
| 8 | Cyber Capabilities and National Power: Vietnam — IISS | https://www.iiss.org/globalassets/media-library---content--migration/files/research-papers/cyber-power-report/cyber-capabilities-and-national-power---vietnam.pdf | 2026-07-24 | Secondary (research) |
| 9 | Không tổ chức công an cấp huyện (4→3 levels) — xaydungchinhsach.chinhphu.vn | https://xaydungchinhsach.chinhphu.vn/khong-to-chuc-cong-an-cap-huyen-quyet-liet-trien-khai-thuc-hien-dua-mo-hinh-bo-may-moi-vao-hoat-dong-tu-1-3-2025-119250219170836315.htm | 2026-07-24 | Official (gov portal) |
| 10 | Vietnam redraws its administrative map — East Asia Forum | https://eastasiaforum.org/2025/09/03/vietnam-redraws-its-administrative-map/ | 2026-07-24 | Secondary (academic) |
| 11 | Vietnam consolidates 63→34 provinces — Vietnam Briefing | https://www.vietnam-briefing.com/news/vietnams-government-introduces-official-plan-for-provincial-mergers.html/ | 2026-07-24 | Secondary |
| 12 | 2025 Vietnamese administrative reform — Wikipedia | https://en.wikipedia.org/wiki/2025_Vietnamese_administrative_reform | 2026-07-24 | Secondary |
| 13 | Two ministries merge (MIC→MoST) — VietnamNet | https://vietnamnet.vn/en/two-ministries-merge-to-drive-digital-transformation-and-efficiency-2349336.html | 2026-07-24 | Secondary (state media) |
| 14 | MoST after merger / amended Cybersecurity Law passed 10 Dec 2025 — vietnam.vn | https://www.vietnam.vn/en/bo-khoa-hoc-va-cong-nghe-sau-hop-nhat-tap-trung-quyen-luc-kien-tao-dong-luc-cho-ky-nguyen-so | 2026-07-24 | Secondary (state portal) |
| 15 | National Cyber Security Center (NCSC) Vietnam — Cybersecurity Intelligence | https://www.cybersecurityintelligence.com/national-cyber-security-center-ncsc-vietnam-8194.html | 2026-07-24 | Secondary |
| 16 | Vietnam's Cybersecurity Law: A Timeline — The Vietnamese | https://www.thevietnamese.org/2023/08/vietnams-cybersecurity-law-a-timeline/ | 2026-07-24 | Secondary |

## 7. Key honesty flags (carried forward as open items)

- **[UNKNOWN]** Exact identity of an "A06" unit; MPS internal codes are inconsistently documented
  — do not hard-code.
- **[UNKNOWN]** Precise post-2025 reporting chain between provincial cyber police and A05, and
  whether A05 mirrors to commune level.
- **[UNKNOWN]** Full text and duty-allocation of the reported 10 Dec 2025 unified Cybersecurity
  Law — verified only via secondary source.
- Several claims rest on secondary sources (law-firm analyses, state media, encyclopedic
  references); primary-law (#3) and official portals (#6, #9) anchor the load-bearing claims.
  **Confirm secondary-only items against the official gazette before relying on specifics in any
  formal/operational decision.**
