#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
일본어 학습 앱 -- 자동 셋업 스크립트
--------------------------------------
수행 작업:
  1. 사전 요구사항 확인 (Node.js, npm, PostgreSQL)
  2. PowerShell 실행 정책 설정
  3. .env 파일 생성 (대화형 입력)
  4. npm install + shared 빌드
  5. PostgreSQL DB 생성
  6. 마이그레이션 실행
  7. 백엔드 서버 시작 (선택)

사용법:
  python setup.py          # 풀 셋업
  python setup.py --start  # 셋업 완료 후 서버 자동 시작
  python setup.py --check  # 사전 요구사항 확인만
"""

import subprocess
import sys
import os
import shutil
import platform
import argparse
from pathlib import Path

# Windows 터미널 UTF-8 출력 강제 설정
if platform.system() == "Windows":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ["PYTHONIOENCODING"] = "utf-8"

# ─── 색상 출력 ────────────────────────────────────────────────
def green(t):  return f"\033[92m{t}\033[0m"
def red(t):    return f"\033[91m{t}\033[0m"
def yellow(t): return f"\033[93m{t}\033[0m"
def cyan(t):   return f"\033[96m{t}\033[0m"
def bold(t):   return f"\033[1m{t}\033[0m"

def ok(msg):   print(f"  {green('✔')} {msg}")
def err(msg):  print(f"  {red('✘')} {msg}")
def warn(msg): print(f"  {yellow('!')} {msg}")
def info(msg): print(f"  {cyan('→')} {msg}")
def step(msg): print(f"\n{bold(msg)}")

ROOT = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT / "packages" / "backend"
IS_WINDOWS = platform.system() == "Windows"

# ─── 유틸 함수 ────────────────────────────────────────────────

def run(cmd, cwd=None, capture=False, shell=True):
    """명령어 실행. 실패 시 예외 발생."""
    result = subprocess.run(
        cmd, cwd=cwd or ROOT, shell=shell,
        capture_output=capture, text=True
    )
    return result

def run_check(cmd, cwd=None):
    """명령어 실행 후 성공 여부 반환."""
    result = subprocess.run(
        cmd, cwd=cwd or ROOT, shell=True,
        capture_output=True, text=True
    )
    return result.returncode == 0, result.stdout.strip(), result.stderr.strip()

def prompt(msg, default=None, secret=False):
    """사용자 입력 받기."""
    default_hint = f" [{default}]" if default else ""
    display = f"  {cyan('?')} {msg}{default_hint}: "
    if secret:
        import getpass
        val = getpass.getpass(display)
    else:
        val = input(display).strip()
    return val or default

# ─── STEP 1: 사전 요구사항 확인 ──────────────────────────────

def check_prerequisites():
    step("STEP 1: 사전 요구사항 확인")
    all_ok = True

    # Node.js
    ok_flag, stdout, _ = run_check("node --version")
    if ok_flag:
        version = stdout.strip()
        major = int(version.lstrip("v").split(".")[0])
        if major >= 20:
            ok(f"Node.js {version}")
        else:
            err(f"Node.js {version} — v20 이상 필요. https://nodejs.org 에서 업데이트")
            all_ok = False
    else:
        err("Node.js 미설치. https://nodejs.org 에서 설치하세요.")
        all_ok = False

    # npm
    ok_flag, stdout, _ = run_check("npm --version")
    if ok_flag:
        ok(f"npm {stdout}")
    else:
        err("npm 미설치.")
        all_ok = False

    # PostgreSQL
    pg_found = False
    pg_path = shutil.which("psql")
    if pg_path:
        ok_flag, stdout, _ = run_check("psql --version")
        ok(f"PostgreSQL ({stdout.strip()})")
        pg_found = True
    else:
        # Windows 기본 설치 경로 탐색 (버전 17~13)
        search_roots = [
            Path("C:/Program Files/PostgreSQL"),
            Path("C:/Program Files (x86)/PostgreSQL"),
        ]
        for root in search_roots:
            if not root.exists():
                continue
            for ver in ["18", "17", "16", "15", "14", "13"]:
                candidate = root / ver / "bin" / "psql.exe"
                if candidate.exists():
                    os.environ["PATH"] += f";{candidate.parent}"
                    ok(f"PostgreSQL {ver} 발견 (PATH 추가): {candidate.parent}")
                    pg_found = True
                    break
            if pg_found:
                break

    if not pg_found:
        warn("psql 명령어를 찾을 수 없습니다.")
        warn("  A) PostgreSQL 설치: https://www.postgresql.org/download/windows/")
        warn("  B) 이미 설치됐다면 PATH에 bin 폴더를 추가하세요:")
        warn("     예) C:\\Program Files\\PostgreSQL\\16\\bin")
        warn("  C) Docker 사용: docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16")
        warn("  ※ psql 없이도 --skip-db 옵션으로 계속 진행할 수 있습니다.")
        all_ok = False

    # Python 버전
    ok(f"Python {sys.version.split()[0]}")

    if not all_ok:
        print(f"\n{red('사전 요구사항을 먼저 설치한 후 다시 실행하세요.')}")
        print(f"  {yellow('또는')} {cyan('python setup.py --skip-db')} 로 DB 단계를 건너뛸 수 있습니다.\n")
        sys.exit(1)

    return True

# ─── STEP 2: PowerShell 실행 정책 설정 (Windows) ─────────────

def fix_execution_policy():
    if not IS_WINDOWS:
        return

    step("STEP 2: PowerShell 실행 정책 확인")
    ok_flag, stdout, _ = run_check(
        'powershell -Command "Get-ExecutionPolicy -Scope CurrentUser"'
    )

    if ok_flag and stdout.strip() in ("RemoteSigned", "Unrestricted", "Bypass"):
        ok(f"실행 정책 정상: {stdout.strip()}")
    else:
        info("실행 정책 설정 중 (RemoteSigned)...")
        run(
            'powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"'
        )
        ok("PowerShell 실행 정책 설정 완료")

# ─── STEP 3: .env 파일 생성 ───────────────────────────────────

def create_env_file():
    step("STEP 3: 백엔드 환경변수(.env) 설정")
    env_path = BACKEND_DIR / ".env"

    if env_path.exists():
        overwrite = prompt(".env 파일이 이미 존재합니다. 덮어쓰시겠습니까? (y/N)", default="N")
        if overwrite.lower() != "y":
            ok(".env 파일 유지 (건너뜀)")
            return

    print()
    info("PostgreSQL 연결 정보를 입력하세요.")
    db_host     = prompt("DB 호스트", default="localhost")
    db_port     = prompt("DB 포트", default="5432")
    db_user     = prompt("DB 사용자명", default="postgres")
    db_password = prompt("DB 비밀번호", secret=True)
    db_name     = prompt("DB 이름", default="japanese_learn_dev")
    jwt_secret  = prompt("JWT 시크릿 (아무 문자열)", default="dev-secret-change-me-in-production")
    port        = prompt("백엔드 서버 포트", default="3000")

    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    env_content = f"""# 데이터베이스 연결
DATABASE_URL={database_url}

# 서버
PORT={port}
NODE_ENV=development

# JWT
JWT_SECRET={jwt_secret}

# Google OAuth (선택 — 미입력 시 OAuth 기능 비활성)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
"""

    env_path.write_text(env_content, encoding="utf-8")
    ok(f".env 파일 생성 완료: {env_path}")

    # DB 정보를 반환해서 Step 5에서 재사용
    return {
        "host": db_host, "port": db_port,
        "user": db_user, "password": db_password,
        "dbname": db_name
    }

# ─── STEP 4: npm install + shared 빌드 ───────────────────────

def npm_install_and_build():
    step("STEP 4: npm install + shared 빌드")

    info("npm install 실행 중... (1~3분 소요)")
    result = run("npm install", cwd=ROOT)
    if result.returncode != 0:
        err("npm install 실패")
        sys.exit(1)
    ok("npm install 완료")

    info("shared 패키지 빌드 중...")
    result = run("npm run build:shared", cwd=ROOT)
    if result.returncode != 0:
        err("shared 빌드 실패")
        sys.exit(1)
    ok("shared 빌드 완료")

# ─── STEP 5: PostgreSQL DB 생성 ───────────────────────────────

def create_database(db_info):
    step("STEP 5: PostgreSQL 데이터베이스 생성")

    if not db_info:
        warn("DB 정보 없음. .env 파일에서 직접 읽습니다.")
        db_info = parse_env_db_info()

    dbname = db_info["dbname"]
    user   = db_info["user"]
    host   = db_info["host"]
    port   = db_info["port"]
    password = db_info.get("password", "")

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    # DB 존재 여부 확인
    check_cmd = f'psql -h {host} -p {port} -U {user} -lqt'
    result = subprocess.run(
        check_cmd, shell=True, capture_output=True, text=True, env=env
    )

    if dbname in result.stdout:
        ok(f"DB '{dbname}' 이미 존재 (건너뜀)")
        return

    # DB 생성
    create_cmd = f'psql -h {host} -p {port} -U {user} -c "CREATE DATABASE {dbname};"'
    result = subprocess.run(
        create_cmd, shell=True, capture_output=True, text=True, env=env
    )

    if result.returncode == 0:
        ok(f"DB '{dbname}' 생성 완료")
    else:
        err(f"DB 생성 실패: {result.stderr}")
        warn("수동으로 생성하세요:")
        warn(f'  psql -U {user} -c "CREATE DATABASE {dbname};"')
        sys.exit(1)

# ─── STEP 6: 마이그레이션 실행 ───────────────────────────────

def run_migrations():
    step("STEP 6: DB 마이그레이션 실행")
    info("마이그레이션 실행 중...")

    result = run(
        "npm run migrate --workspace=packages/backend",
        cwd=ROOT
    )

    if result.returncode == 0:
        ok("마이그레이션 완료")
    else:
        err("마이그레이션 실패. DATABASE_URL과 PostgreSQL 상태를 확인하세요.")
        sys.exit(1)

# ─── STEP 7: 백엔드 서버 시작 ────────────────────────────────

def kill_port(port: int):
    """해당 포트를 사용 중인 프로세스를 종료합니다."""
    result = subprocess.run(
        f'netstat -ano | findstr :{port}',
        shell=True, capture_output=True, text=True
    )
    pids = set()
    for line in result.stdout.splitlines():
        parts = line.strip().split()
        if parts and "LISTENING" in line:
            pids.add(parts[-1])

    if not pids:
        return

    for pid in pids:
        if pid == "0":
            continue
        r = subprocess.run(f'taskkill /PID {pid} /F', shell=True, capture_output=True, text=True)
        if r.returncode == 0:
            warn(f"포트 {port} 점유 프로세스(PID {pid}) 종료됨")

def start_backend():
    step("STEP 7: 백엔드 서버 시작")
    kill_port(3000)
    info("서버 시작 중... (Ctrl+C로 종료)")
    print()

    try:
        process = subprocess.Popen(
            "npm run backend",
            cwd=ROOT,
            shell=True,
        )
        process.wait()
    except KeyboardInterrupt:
        print(f"\n{yellow('서버를 종료했습니다.')}")

def start_web():
    step("Expo 웹 앱 시작 (모바일 앱 브라우저 버전)")
    kill_port(8081)
    kill_port(19000)
    info("웹 앱 시작 중... 브라우저가 자동으로 열립니다. (Ctrl+C로 종료)")
    info("백엔드 서버가 별도 터미널에서 실행 중이어야 합니다.")
    print()

    try:
        process = subprocess.Popen(
            "npm run web",
            cwd=ROOT,
            shell=True,
        )
        process.wait()
    except KeyboardInterrupt:
        print(f"\n{yellow('웹 앱을 종료했습니다.')}")

def start_dashboard():
    step("웹 대시보드 시작 (React + Vite)")
    kill_port(5173)
    info("대시보드 시작 중... http://localhost:5173 (Ctrl+C로 종료)")
    info("백엔드 서버가 별도 터미널에서 실행 중이어야 합니다.")
    print()

    try:
        process = subprocess.Popen(
            "npm run dashboard",
            cwd=ROOT,
            shell=True,
        )
        process.wait()
    except KeyboardInterrupt:
        print(f"\n{yellow('대시보드를 종료했습니다.')}")

# ─── .env 파싱 (이미 있는 경우) ──────────────────────────────

def parse_env_db_info():
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return None

    db_url = None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip()
            break

    if not db_url:
        return None

    # postgresql://user:pass@host:port/dbname 파싱
    try:
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        return {
            "host": parsed.hostname or "localhost",
            "port": str(parsed.port or 5432),
            "user": parsed.username or "postgres",
            "password": parsed.password or "",
            "dbname": parsed.path.lstrip("/"),
        }
    except Exception:
        return None

# ─── 메인 ────────────────────────────────────────────────────

def print_banner():
    print(bold(cyan("""
+======================================+
|   일본어 학습 앱 -- 자동 셋업 스크립트  |
+======================================+
""")))

def print_done(auto_start):
    print(f"""
{green(bold('✔ 셋업 완료!'))}

이제 아래 명령으로 실행하세요:

  {cyan('터미널 1 (백엔드 API):')}
    npm run backend

  {cyan('터미널 2A (웹 대시보드 - 권장):')}
    npm run dashboard
    --> http://localhost:5173  (주간리포트 / 오늘할일 / 실험현황)

  {cyan('터미널 2B (모바일 앱 웹 버전):')}
    npm run web
    --> http://localhost:8081  (Expo Web)

  {cyan('터미널 2C (스마트폰 - Expo Go):')}
    npm run mobile
    --> Expo Go 앱으로 QR코드 스캔

  {cyan('백엔드 헬스체크:')}
    http://localhost:3000/health
""")
    if not auto_start:
        print(f"  {yellow('팁:')} 대시보드 바로 시작: {cyan('python setup.py --dashboard')}")
        print(f"  {yellow('팁:')} 백엔드 바로 시작:  {cyan('python setup.py --start')}\n")

def main():
    print_banner()

    parser = argparse.ArgumentParser(description="일본어 학습 앱 셋업")
    parser.add_argument("--start",       action="store_true", help="셋업 후 백엔드 서버 자동 시작")
    parser.add_argument("--web",         action="store_true", help="Expo 웹 앱 시작 (npm run web)")
    parser.add_argument("--dashboard",   action="store_true", help="웹 대시보드 시작 (React+Vite, http://localhost:5173)")
    parser.add_argument("--check",       action="store_true", help="사전 요구사항 확인만")
    parser.add_argument("--migrate-only",action="store_true", help="마이그레이션만 실행")
    parser.add_argument("--skip-db",     action="store_true", help="DB 생성/마이그레이션 건너뜀")
    args = parser.parse_args()

    if args.check:
        check_prerequisites()
        print(f"\n{green('모든 사전 요구사항 충족!')}")
        return

    if args.migrate_only:
        run_migrations()
        return

    if args.web:
        start_web()
        return

    if args.dashboard:
        start_dashboard()
        return

    # 풀 셋업
    try:
        check_prerequisites()
    except SystemExit:
        if not args.skip_db:
            raise
        warn("PostgreSQL 미확인 상태로 진행합니다 (--skip-db).")

    fix_execution_policy()
    db_info = create_env_file()

    # .env가 이미 있어서 db_info가 None인 경우
    if db_info is None:
        db_info = parse_env_db_info()

    npm_install_and_build()

    if not args.skip_db:
        create_database(db_info)
        run_migrations()
    else:
        warn("DB 생성 및 마이그레이션을 건너뜁니다 (--skip-db).")
        warn("나중에 직접 실행: python setup.py --migrate-only")

    print_done(args.start)

    if args.start:
        start_backend()

if __name__ == "__main__":
    main()
