# ─────────────────────────────────────────────────────────────
# Analyst CLI — Makefile shortcut
#
# Pakai `analyst` global kalau sudah `npm install -g .`,
# kalau belum otomatis fallback ke `node <repo>/src/index.js`.
# Override manual: make CLI="node /path/ke/analyst-cli/src/index.js" h2h
# ─────────────────────────────────────────────────────────────
CLI ?= $(shell command -v analyst 2>/dev/null || echo "node $(CURDIR)/src/index.js")

# Variabel default — override saat memanggil, mis: make product PRODUCT="Aplikasi LOS"
PRODUCT ?= Host 2 Host
DOC     ?= brd
FORCE   ?=
FORCE_FLAG := $(if $(FORCE),--force,)

.DEFAULT_GOAL := help

.PHONY: help product add list detail remove docs \
        h2h onboarding los all-products brd srs api db uiux \
        test-plan test-case sit uat deploy manual

## help: tampilkan daftar target
help:
	@echo ""
	@echo "🔷 Analyst CLI — Makefile"
	@echo ""
	@echo "  make product PRODUCT=\"Host 2 Host\"     buat produk + 11 dokumen"
	@echo "  make add DOC=brd PRODUCT=\"Host 2 Host\"  generate 1 dokumen"
	@echo "  make add DOC=api PRODUCT=\"H2H\" FORCE=1  generate ulang (timpa)"
	@echo "  make list                              lihat semua produk"
	@echo "  make detail PRODUCT=\"Host 2 Host\"       detail dokumen 1 produk"
	@echo "  make remove PRODUCT=\"Host 2 Host\"       hapus produk"
	@echo "  make docs                              daftar jenis dokumen"
	@echo ""
	@echo "  Shortcut produk: make h2h | onboarding | los | all-products"
	@echo "  Shortcut dokumen: make brd|srs|api|db|uiux|test-plan|test-case|sit|uat|deploy|manual PRODUCT=\"...\""
	@echo ""

## product: buat produk + scaffold 11 dokumen
product:
	$(CLI) new product "$(PRODUCT)" $(FORCE_FLAG)

## add: generate/regenerate satu dokumen (DOC=<jenis> PRODUCT=<nama> [FORCE=1])
add:
	$(CLI) add $(DOC) -p "$(PRODUCT)" $(FORCE_FLAG)

## list / detail / remove / docs
list:
	$(CLI) list

detail:
	$(CLI) list "$(PRODUCT)"

remove:
	$(CLI) remove product "$(PRODUCT)"

docs:
	$(CLI) docs

# ── Shortcut produk standar ──────────────────────────────────
h2h:
	$(CLI) new product "Host 2 Host"

onboarding:
	$(CLI) new product "Aplikasi Onboarding"

los:
	$(CLI) new product "Aplikasi LOS"

all-products: h2h onboarding los
	@$(CLI) list

# ── Shortcut per dokumen (pakai PRODUCT=...) ─────────────────
brd:        ; $(CLI) add brd -p "$(PRODUCT)" $(FORCE_FLAG)
srs:        ; $(CLI) add srs -p "$(PRODUCT)" $(FORCE_FLAG)
api:        ; $(CLI) add api-contract -p "$(PRODUCT)" $(FORCE_FLAG)
db:         ; $(CLI) add database-design -p "$(PRODUCT)" $(FORCE_FLAG)
uiux:       ; $(CLI) add uiux-design -p "$(PRODUCT)" $(FORCE_FLAG)
test-plan:  ; $(CLI) add test-plan -p "$(PRODUCT)" $(FORCE_FLAG)
test-case:  ; $(CLI) add test-case -p "$(PRODUCT)" $(FORCE_FLAG)
sit:        ; $(CLI) add sit -p "$(PRODUCT)" $(FORCE_FLAG)
uat:        ; $(CLI) add uat -p "$(PRODUCT)" $(FORCE_FLAG)
deploy:     ; $(CLI) add deployment-guide -p "$(PRODUCT)" $(FORCE_FLAG)
manual:     ; $(CLI) add user-manual -p "$(PRODUCT)" $(FORCE_FLAG)
