PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations VALUES(1,'0001_initial_schema.sql','2026-06-09 08:27:35');
INSERT INTO d1_migrations VALUES(2,'0002_v4_departments_positions.sql','2026-06-09 09:37:41');
INSERT INTO d1_migrations VALUES(3,'0003_v5_tenant_scope_and_first_login.sql','2026-06-09 12:58:05');
INSERT INTO d1_migrations VALUES(4,'0004_v7_reservation_attendees.sql','2026-06-10 05:02:21');
INSERT INTO d1_migrations VALUES(5,'0005_v11_tenant_schedule_color.sql','2026-06-10 08:39:18');
CREATE TABLE _cf_METADATA (
        key INTEGER PRIMARY KEY,
        value BLOB
      );
INSERT INTO _cf_METADATA VALUES(2,14059);
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0066cc',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, schedule_color TEXT NOT NULL DEFAULT '#0066cc');
INSERT INTO tenants VALUES('WYLIE','와일리','#0066cc','2026-06-09 08:27:38','#703b96');
INSERT INTO tenants VALUES('LUSH','러쉬코리아','#1d1d1f','2026-06-09 08:27:38','#d81b60');
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member', 
  status TEXT NOT NULL DEFAULT 'active', 
  avatar_color TEXT DEFAULT '#7a7a7a',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_first_login INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
INSERT INTO users VALUES(1,'WYLIE','admin@wylie.co.kr','ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270','마스터(WYLIE)',NULL,NULL,NULL,'admin','active','#0066cc','2026-06-09 08:27:38',0);
INSERT INTO users VALUES(15,'LUSH','admin@lush.co.kr','ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270','관리자 (LUSH)',NULL,NULL,NULL,'admin','active','#1d1d1f','2026-06-09 12:58:14',0);
INSERT INTO users VALUES(17,'WYLIE','bhmoon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','문병훈','인재전략실','GM',NULL,'member','active','#06b6d4','2026-06-09 13:22:22',0);
INSERT INTO users VALUES(18,'WYLIE','2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','123@wylie.co.kr',NULL,NULL,NULL,'member','active','#06b6d4','2026-06-10 02:18:16',0);
INSERT INTO users VALUES(22,'LUSH','2@lush.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','2',NULL,NULL,NULL,'member','active','#8b5cf6','2026-06-10 04:01:28',0);
INSERT INTO users VALUES(23,'WYLIE','ssk@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','송선규','플랫폼운영본부','GH',NULL,'member','active','#ef4444','2026-06-10 04:42:07',1);
INSERT INTO users VALUES(24,'WYLIE','shchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최승효','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:07',1);
INSERT INTO users VALUES(25,'WYLIE','hsoh@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','오항석','플랫폼운영본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:07',1);
INSERT INTO users VALUES(26,'WYLIE','wjlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이운주','컨버전스 2본부','GL',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(27,'WYLIE','yelee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이영은','플랫폼운영본부','GP',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(28,'WYLIE','ehlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이은혜','플랫폼운영본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(29,'WYLIE','yhkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김영환','컨버전스 2본부','GP',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(30,'WYLIE','oskim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김오성','신성장사업본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(31,'WYLIE','hmkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김혜미','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(32,'WYLIE','skahn@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','안선균','플랫폼운영본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(33,'WYLIE','jiryu@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','유정인','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(34,'WYLIE','dhlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이다현','플랫폼운영본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(35,'WYLIE','jesong@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','송지은','플랫폼운영본부','GL',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(36,'WYLIE','jslee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이정선','플랫폼운영본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(37,'WYLIE','stcho@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','조승태','플랫폼운영본부','GL',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(38,'WYLIE','dbhwang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','황다빈','컨버전스 3본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(39,'WYLIE','mskang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','강민선','플랫폼운영본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(40,'WYLIE','selee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이시은','플랫폼운영본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(41,'WYLIE','hhseo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','서환희','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(42,'WYLIE','jaehapark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박재하','컨버전스 2본부','GH',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(43,'WYLIE','wjlee1@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이우재','플랫폼운영본부','GL',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(44,'WYLIE','cwlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이철원','플랫폼운영본부','GM',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(45,'WYLIE','youngman@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','윤영만','컨버전스 3본부','GH',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(46,'WYLIE','sgyu@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','유성구','컨버전스 3본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(47,'WYLIE','hbchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최혁빈','신성장사업본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(48,'WYLIE','nwkang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','강남욱','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(49,'WYLIE','sunga@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','손성아','플랫폼운영본부','GP',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(50,'WYLIE','shjin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','진세호','플랫폼운영본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(51,'WYLIE','jhyang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','양지호','플랫폼운영본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(52,'WYLIE','yhkim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김연희','플랫폼운영본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(53,'WYLIE','shjung@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정세화','플랫폼운영본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(54,'WYLIE','stshim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','심석태','컨버전스 3본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(55,'WYLIE','sjahn@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','안선정','플랫폼운영본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(56,'WYLIE','mhjung@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정민혁','컨버전스 3본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(57,'WYLIE','jspark2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박지성','플랫폼운영본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(58,'WYLIE','nygi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','기나영','컨버전스 3본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(59,'WYLIE','jhshin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신재현','컨버전스 1본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(60,'WYLIE','sbhwang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','황수빈','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(61,'WYLIE','hwlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이현우','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(62,'WYLIE','jhsim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','심재훈','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(63,'WYLIE','nkkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김남경','컨버전스 3본부','GL',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(64,'WYLIE','aycheon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전아영','플랫폼운영본부','GL',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(65,'WYLIE','hskwon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','권현숙','컨버전스 3본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(66,'WYLIE','yrkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김유림','컨버전스 3본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(67,'WYLIE','shlee1@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이상훈','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(68,'WYLIE','sgkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김승구','플랫폼운영본부','GP',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(69,'WYLIE','skpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박수경','경영전략실','GH',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(70,'WYLIE','jhkim1@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김정한','컨버전스 2본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(71,'WYLIE','wsjang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','장운석','신성장사업본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(72,'WYLIE','shpark2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박소현','플랫폼운영본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(73,'WYLIE','yykim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김유영','인재전략실','GL',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(74,'WYLIE','sekim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김송이','인재전략실','GL',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(75,'WYLIE','mjkim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김민재','플랫폼운영본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(76,'WYLIE','sgsa@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','사승기','컨버전스 2본부','GP',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(77,'WYLIE','jpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박준','인재전략실','GL',NULL,'admin','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(78,'WYLIE','yjjang2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','장윤진','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(79,'WYLIE','hjroh@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','노희진','마케팅캠페인본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(80,'WYLIE','heetopia0905@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이한희','플랫폼운영본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(81,'WYLIE','bhlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이보혜','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(82,'WYLIE','jhpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박주혜','컨버전스 3본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(83,'WYLIE','sypark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박세영','인재전략실','GH',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(84,'WYLIE','hskim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김혜수','컨버전스 2본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(85,'WYLIE','islee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이인숙','컨버전스 2본부','GP',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(86,'WYLIE','seohan@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박서한','신성장사업본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(87,'WYLIE','bskim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김범석','컨버전스 3본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(88,'WYLIE','ykbyun@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','변유경','플랫폼운영본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(89,'WYLIE','ssshin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신상섭','플랫폼운영본부','GP',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(90,'WYLIE','mrkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김미르','컨버전스 3본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(91,'WYLIE','hjkim1@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김형진','컨버전스 2본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(92,'WYLIE','soohwan@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신수환','컨버전스 2본부','GP',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(93,'WYLIE','pyo0700@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','유경표','컨버전스 1본부','GH',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(94,'WYLIE','justinyoon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','윤평강','마케팅캠페인본부','GH',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(95,'WYLIE','s9667004@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전현정','플랫폼운영본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(96,'WYLIE','hsjun@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전해송','컨버전스 2본부','GA',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(97,'WYLIE','yoon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','구재윤','컨버전스 3본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(98,'WYLIE','jmkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김진문','컨버전스 3본부','GL',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(99,'WYLIE','bmsim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','심보미','컨버전스 2본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(100,'WYLIE','jsshim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','심준선','퍼포먼스플랫폼본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(101,'WYLIE','jsheo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','허재성','컨버전스 2본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(102,'WYLIE','kwkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김경원','신성장사업본부','GL',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(103,'WYLIE','momo702@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최기영','플랫폼운영본부','GM',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(104,'WYLIE','jhchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최진혁','플랫폼운영본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(105,'WYLIE','myjo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','조미영','신성장사업본부','GL',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(106,'WYLIE','thkwak@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','곽태현','컨버전스 2본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(107,'WYLIE','syjeon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전소영','경영전략실','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(108,'WYLIE','w3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정재우','마케팅캠페인본부','GH',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(109,'WYLIE','jycha@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','차준영','퍼포먼스플랫폼본부','GH',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(110,'WYLIE','bmkang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','강병민','퍼포먼스플랫폼본부','GP',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(111,'WYLIE','grlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이가람','퍼포먼스플랫폼본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(112,'WYLIE','sjlim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임선진','퍼포먼스플랫폼본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(113,'WYLIE','tkkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김태경','컨버전스 3본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(114,'WYLIE','smlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이새미','컨버전스 3본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(115,'WYLIE','yrlim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임유리','마케팅캠페인본부','GL',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(116,'WYLIE','swseo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','서신원','컨버전스 2본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(117,'WYLIE','sho@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','오세향','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(118,'WYLIE','nrkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김누리','컨버전스 3본부','GA',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(119,'WYLIE','sglee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이상근','컨버전스 3본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(120,'WYLIE','yuju@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김유주','컨버전스 2본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(121,'WYLIE','yckim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김용찬','컨버전스 2본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(122,'WYLIE','ajkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김아진','신성장사업본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(123,'WYLIE','mapark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박민아','마케팅캠페인본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(124,'WYLIE','jhjo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','조장흠','신성장사업본부','GA',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(125,'WYLIE','jwbaik@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','백지원','퍼포먼스플랫폼본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(126,'WYLIE','hjshin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신현진','마케팅캠페인본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(127,'WYLIE','bmim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임보미','인재전략실','GM',NULL,'admin','active','#10b981','2026-06-10 04:42:08',0);
INSERT INTO users VALUES(128,'WYLIE','shbang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','방승화','컨버전스 3본부','GL',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(129,'WYLIE','kbhwang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','황광봉','플랫폼운영본부','GL',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(130,'WYLIE','dlclrh1002@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','류상희','플랫폼운영본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(131,'WYLIE','jhkim4@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김종혁','마케팅캠페인본부','GA',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(132,'WYLIE','monobe@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박태영','신성장사업본부','GP',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(133,'WYLIE','hylim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임하영','마케팅캠페인본부','GA',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(134,'WYLIE','cllee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이채련','플랫폼운영본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(135,'WYLIE','sbpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박새봄','컨버전스 3본부','GL',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(136,'WYLIE','ehkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김은해','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(137,'WYLIE','aryn@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정아린','컨버전스 2본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(138,'WYLIE','ehkim1@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김은해','플랫폼운영본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(139,'WYLIE','hskim4@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김회승','컨버전스 1본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(140,'WYLIE','cikim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김찬익','플랫폼운영본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(141,'WYLIE','cokwon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','권충오','신성장사업본부','GA',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(142,'WYLIE','hmlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이혜민','컨버전스 1본부','GA',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(143,'WYLIE','dmjeong@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정동민','플랫폼운영본부','GA',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(144,'WYLIE','jachoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최지안','컨버전스 2본부','GM',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(145,'WYLIE','nlbae@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','배남이','컨버전스 3본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(146,'WYLIE','scpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박성찬','플랫폼운영본부','GA',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(147,'WYLIE','jmkim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김지민','컨버전스 3본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(148,'WYLIE','vrtra3f@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정명관','컨버전스 1본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(149,'WYLIE','smbae@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','배소민','컨버전스 3본부','GA',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(150,'WYLIE','ischoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최인선','컨버전스 3본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(151,'WYLIE','sklee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이석균','마케팅캠페인본부','GP',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(152,'WYLIE','ywshin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신영우','신성장사업본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(153,'WYLIE','hkkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김혜경','신성장사업본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(154,'WYLIE','jhso@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','소지희','컨버전스 2본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(155,'WYLIE','thkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김태현','신성장사업본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(156,'WYLIE','isyun@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','윤인수','컨버전스 1본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(157,'WYLIE','hjkim3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김형중','신성장사업본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(158,'WYLIE','rekim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김려은','퍼포먼스플랫폼본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(159,'WYLIE','ejkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김은정','플랫폼운영본부','GM',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(160,'WYLIE','mkchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최민경','플랫폼운영본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(161,'WYLIE','d3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이동욱','마케팅캠페인본부','GP',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(162,'WYLIE','zero@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박하영','마케팅캠페인본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(163,'WYLIE','yrkim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김유리','마케팅캠페인본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(164,'WYLIE','jhlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이진희','컨버전스 2본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(165,'WYLIE','hsjeong@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정희석','플랫폼운영본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(166,'WYLIE','hjyun2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','윤희지','컨버전스 2본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(167,'WYLIE','yhkim3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김윤혜','컨버전스 2본부','GM',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(168,'WYLIE','hllim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임화란','플랫폼운영본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(169,'WYLIE','jhlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이지현','컨버전스 1본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(170,'WYLIE','chris_kwak@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','곽인수','신성장사업본부','GH',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(171,'WYLIE','kmlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이경민','컨버전스 3본부','GA',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(172,'WYLIE','jsim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','임지수','컨버전스 2본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(173,'WYLIE','hjwee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','위혜지','퍼포먼스플랫폼본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(174,'WYLIE','jhan@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','안지혜','플랫폼운영본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(175,'WYLIE','jbsuk@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','석진비','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(176,'WYLIE','jyhwang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','황지영','플랫폼운영본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(177,'WYLIE','yjshim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','심유주','컨버전스 2본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(178,'WYLIE','jhoh2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','오지훈','플랫폼운영본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(179,'WYLIE','tjhan@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','한태진','신성장사업본부','GM',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(180,'WYLIE','hwson@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','손혜원','컨버전스 3본부','GP',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(181,'WYLIE','sbpark2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박수빈','퍼포먼스플랫폼본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(182,'WYLIE','esseo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','서의석','컨버전스 2본부','GL',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(183,'WYLIE','nykye@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','계나영','신성장사업본부','GA',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(184,'WYLIE','gmkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김경민','컨버전스 2본부','GA',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(185,'WYLIE','cmsong@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','송치문','컨버전스 1본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(186,'WYLIE','iskwag@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','곽일신','신성장사업본부','GP',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(187,'WYLIE','himin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','민혜인','컨버전스 2본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(188,'WYLIE','hjlee@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이호정','플랫폼운영본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(189,'WYLIE','jsko@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','고지수','컨버전스 2본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(190,'WYLIE','yecha@wyile.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','차예은','마케팅캠페인본부','GA',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(191,'WYLIE','ysjoo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','주영상','플랫폼운영본부','GL',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(192,'WYLIE','separk@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박시은','신성장사업본부','GA',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(193,'WYLIE','ijkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김익중','컨버전스 2본부','GL',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(194,'WYLIE','jhpark2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박지혜','마케팅캠페인본부','GL',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(195,'WYLIE','syjeong@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정성윤','마케팅캠페인본부','GA',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(196,'WYLIE','jypark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박지영','마케팅캠페인본부','GA',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(197,'WYLIE','sskim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김성수','컨버전스 1본부','GM',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(198,'WYLIE','jslee4@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이지수','마케팅캠페인본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(199,'WYLIE','hyjeon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전하영','신성장사업본부','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(200,'WYLIE','sgpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박슬기','신성장사업본부','GM',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(201,'WYLIE','dhshin@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','신동환','신성장사업본부','GL',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(202,'WYLIE','thkim2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김태현','퍼포먼스플랫폼본부','GA',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(203,'WYLIE','dhkang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','강다현','컨버전스 3본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(204,'WYLIE','ihwoo@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','우인호','마케팅캠페인본부','GP',NULL,'member','active','#ec4899','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(205,'WYLIE','yrkim3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김예린','퍼포먼스플랫폼본부','GA',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(206,'WYLIE','jmlee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이정민','경영전략실','GM',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(207,'WYLIE','hgpark@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박호근','신성장사업본부','GM',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(208,'WYLIE','djoh@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','오동준','경영전략실','GH',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(209,'WYLIE','shpark4@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박수현','플랫폼운영본부','GA',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(210,'WYLIE','dylee2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이다영','컨버전스 2본부','GA',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(211,'WYLIE','shlee3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','이상호','컨버전스 1본부','GA',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(212,'WYLIE','dhchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최다희','컨버전스 1본부','GA',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(213,'WYLIE','mapark2@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','박민아','컨버전스 1본부','GA',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(214,'WYLIE','jsjeon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전재성','신성장사업본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(215,'WYLIE','sakim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김선아','컨버전스 2본부','GL',NULL,'member','active','#06b6d4','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(216,'WYLIE','ghcho@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','조강희','컨버전스 1본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(217,'WYLIE','shyu@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','유승훈','마케팅캠페인본부','GM',NULL,'member','active','#facc15','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(218,'WYLIE','dgkim@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김동규','AX혁신센터','GA',NULL,'member','active','#0066cc','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(219,'WYLIE','jhjeon@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','전정호','마케팅캠페인본부','GA',NULL,'member','active','#10b981','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(220,'WYLIE','jhjung@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','정재형','컨버전스 3본부','GP',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(221,'WYLIE','jwkim3@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','김진우','컨버전스 3본부','GA',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(222,'WYLIE','dnbaek@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','백다나','플랫폼운영본부','GA',NULL,'member','active','#ef4444','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(223,'WYLIE','hryang@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','양혜림','마케팅캠페인본부','GL',NULL,'member','active','#f97316','2026-06-10 04:42:08',1);
INSERT INTO users VALUES(224,'WYLIE','jwchoi@wylie.co.kr','831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb','최정원','마케팅캠페인본부','GM',NULL,'member','active','#8b5cf6','2026-06-10 04:42:08',1);
CREATE TABLE spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, 
  capacity INTEGER DEFAULT 0,
  color TEXT DEFAULT '#0066cc',
  count_in_limit INTEGER DEFAULT 1, 
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, tenant_scope TEXT DEFAULT NULL);
INSERT INTO spaces VALUES(1,'Meeting Room A','meeting_room',8,'#ef4444',1,1,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(2,'Meeting Room B','meeting_room',8,'#f59e0b',1,2,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(3,'Meeting Room C','meeting_room',8,'#10b981',1,3,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(4,'Meeting Room D','meeting_room',8,'#0066cc',1,4,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(5,'Meeting Room E','meeting_room',8,'#8b5cf6',1,5,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(6,'Lounge','common_space',80,'#7a7a7a',0,6,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(7,'Recharging Zone','common_space',1,'#7a7a7a',0,7,'2026-06-09 08:27:38',NULL);
INSERT INTO spaces VALUES(8,'Conference Room','meeting_room',18,'#ec4899',0,8,'2026-06-09 12:34:49','WYLIE');
INSERT INTO spaces VALUES(9,'파라다이스룸','meeting_room',4,'#0066cc',0,9,'2026-06-09 13:25:31','LUSH');
CREATE TABLE recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  frequency TEXT NOT NULL, 
  end_type TEXT NOT NULL, 
  end_date TEXT,
  end_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO recurring_rules VALUES(1,'weekly','count',NULL,5,'2026-06-09 08:28:35');
INSERT INTO recurring_rules VALUES(2,'weekly','date','2026-07-09',10,'2026-06-09 09:13:56');
INSERT INTO recurring_rules VALUES(3,'weekly','count','2026-07-10',2,'2026-06-10 01:39:03');
INSERT INTO recurring_rules VALUES(4,'weekly','count','2026-07-10',2,'2026-06-10 01:43:45');
INSERT INTO recurring_rules VALUES(5,'daily','count',NULL,3,'2026-06-10 02:05:20');
INSERT INTO recurring_rules VALUES(6,'weekly','count','2026-07-10',3,'2026-06-10 02:29:09');
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  space_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '새로운 일정',
  date TEXT NOT NULL, 
  start_time TEXT NOT NULL, 
  end_time TEXT NOT NULL, 
  attendees TEXT, 
  recurring_rule_id INTEGER,
  created_by_admin INTEGER DEFAULT 0, 
  status TEXT DEFAULT 'confirmed', 
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (space_id) REFERENCES spaces(id),
  FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id)
);
INSERT INTO reservations VALUES(1,'WYLIE',1,1,'[PPD] 유동원 컨설팅','2026-06-09','10:40','12:00',NULL,NULL,1,'cancelled','2026-06-09 08:27:38','2026-06-09 08:27:38');
INSERT INTO reservations VALUES(5,'WYLIE',1,5,'월간 전사 회의','2026-06-10','15:00','17:00',NULL,NULL,1,'cancelled','2026-06-09 08:27:38','2026-06-09 08:27:38');
INSERT INTO reservations VALUES(11,'WYLIE',1,4,'전사 회의','2026-06-09','16:00','17:00',NULL,NULL,1,'cancelled','2026-06-09 08:28:19','2026-06-09 08:28:19');
INSERT INTO reservations VALUES(13,'WYLIE',1,5,'주간보고','2026-06-16','09:00','10:00',NULL,1,1,'cancelled','2026-06-09 08:28:35','2026-06-09 08:28:35');
INSERT INTO reservations VALUES(14,'WYLIE',1,5,'주간보고','2026-06-23','09:00','10:00',NULL,1,1,'cancelled','2026-06-09 08:28:35','2026-06-09 08:28:35');
INSERT INTO reservations VALUES(15,'WYLIE',1,5,'주간보고','2026-06-30','09:00','10:00',NULL,1,1,'cancelled','2026-06-09 08:28:35','2026-06-09 08:28:35');
INSERT INTO reservations VALUES(16,'WYLIE',1,5,'주간보고','2026-07-07','09:00','10:00',NULL,1,1,'cancelled','2026-06-09 08:28:35','2026-06-09 08:28:35');
INSERT INTO reservations VALUES(17,'WYLIE',1,5,'주간보고','2026-07-14','09:00','10:00',NULL,1,1,'cancelled','2026-06-09 08:28:35','2026-06-09 08:28:35');
INSERT INTO reservations VALUES(18,'WYLIE',1,2,'새로운 일정','2026-06-09','09:30','10:30',NULL,2,1,'cancelled','2026-06-09 09:13:56','2026-06-09 09:13:56');
INSERT INTO reservations VALUES(19,'WYLIE',1,2,'새로운 일정','2026-06-16','09:30','10:30',NULL,2,1,'cancelled','2026-06-09 09:13:56','2026-06-09 09:13:56');
INSERT INTO reservations VALUES(20,'WYLIE',1,2,'새로운 일정','2026-06-23','09:30','10:30',NULL,2,1,'cancelled','2026-06-09 09:13:56','2026-06-09 09:13:56');
INSERT INTO reservations VALUES(21,'WYLIE',1,2,'새로운 일정','2026-06-30','09:30','10:30',NULL,2,1,'cancelled','2026-06-09 09:13:56','2026-06-09 09:13:56');
INSERT INTO reservations VALUES(22,'WYLIE',1,2,'새로운 일정','2026-07-07','09:30','10:30',NULL,2,1,'confirmed','2026-06-09 09:13:56','2026-06-09 09:13:56');
INSERT INTO reservations VALUES(24,'WYLIE',1,3,'새로운 일정','2026-06-09','04:00','06:30',NULL,NULL,1,'cancelled','2026-06-09 09:32:20','2026-06-09 09:32:20');
INSERT INTO reservations VALUES(25,'WYLIE',1,4,'새로운 일정','2026-06-09','03:30','07:00',NULL,NULL,1,'cancelled','2026-06-09 09:32:22','2026-06-09 09:32:22');
INSERT INTO reservations VALUES(26,'WYLIE',1,5,'새로운 일정','2026-06-09','03:30','07:30',NULL,NULL,1,'cancelled','2026-06-09 09:32:24','2026-06-09 09:32:24');
INSERT INTO reservations VALUES(27,'WYLIE',1,6,'새로운 일정','2026-06-09','03:30','07:30',NULL,NULL,1,'cancelled','2026-06-09 09:32:25','2026-06-09 09:32:25');
INSERT INTO reservations VALUES(28,'WYLIE',1,8,'WYLIE 회의','2026-06-20','10:00','11:00',NULL,NULL,1,'confirmed','2026-06-09 13:01:56','2026-06-09 13:01:56');
INSERT INTO reservations VALUES(29,'WYLIE',1,2,'새로운 일정','2026-06-09','03:00','03:30',NULL,NULL,1,'confirmed','2026-06-09 13:20:49','2026-06-09 13:20:49');
INSERT INTO reservations VALUES(30,'WYLIE',1,3,'새로운 일정','2026-06-09','03:30','04:00',NULL,NULL,1,'confirmed','2026-06-09 13:20:51','2026-06-09 13:20:51');
INSERT INTO reservations VALUES(31,'WYLIE',1,4,'새로운 일정','2026-06-09','03:30','04:00',NULL,NULL,1,'confirmed','2026-06-09 13:20:53','2026-06-09 13:20:53');
INSERT INTO reservations VALUES(32,'WYLIE',17,2,'새로운 일정','2026-06-09','04:30','05:00',NULL,NULL,0,'cancelled','2026-06-09 13:23:01','2026-06-09 13:23:50');
INSERT INTO reservations VALUES(33,'WYLIE',17,3,'새로운 일정','2026-06-09','05:00','05:30',NULL,NULL,0,'cancelled','2026-06-09 13:23:03','2026-06-09 13:23:03');
INSERT INTO reservations VALUES(34,'WYLIE',17,4,'새로운 일정','2026-06-09','05:00','05:30',NULL,NULL,0,'cancelled','2026-06-09 13:23:04','2026-06-09 13:23:04');
INSERT INTO reservations VALUES(35,'WYLIE',17,5,'새로운 일정','2026-06-09','05:00','05:30',NULL,NULL,0,'cancelled','2026-06-09 13:23:06','2026-06-09 13:23:06');
INSERT INTO reservations VALUES(36,'WYLIE',17,2,'새로운 일정','2026-06-09','05:30','06:00',NULL,NULL,0,'cancelled','2026-06-09 13:23:09','2026-06-09 13:23:09');
INSERT INTO reservations VALUES(37,'LUSH',15,3,'새로운 일정','2026-06-09','04:00','04:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:29','2026-06-09 13:24:29');
INSERT INTO reservations VALUES(38,'LUSH',15,4,'새로운 일정','2026-06-09','04:30','05:00',NULL,NULL,1,'confirmed','2026-06-09 13:24:31','2026-06-09 13:24:31');
INSERT INTO reservations VALUES(39,'LUSH',15,4,'새로운 일정','2026-06-09','04:00','04:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:39','2026-06-09 13:24:39');
INSERT INTO reservations VALUES(40,'LUSH',15,5,'새로운 일정','2026-06-09','04:30','05:00',NULL,NULL,1,'confirmed','2026-06-09 13:24:40','2026-06-09 13:24:40');
INSERT INTO reservations VALUES(41,'LUSH',15,5,'새로운 일정','2026-06-09','04:00','04:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:42','2026-06-09 13:24:42');
INSERT INTO reservations VALUES(42,'LUSH',15,4,'새로운 일정','2026-06-09','08:00','08:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:47','2026-06-09 13:24:47');
INSERT INTO reservations VALUES(43,'LUSH',15,3,'새로운 일정','2026-06-09','07:00','07:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:48','2026-06-09 13:24:48');
INSERT INTO reservations VALUES(44,'LUSH',15,5,'새로운 일정','2026-06-09','06:00','06:30',NULL,NULL,1,'confirmed','2026-06-09 13:24:51','2026-06-09 13:24:51');
INSERT INTO reservations VALUES(45,'LUSH',15,9,'새로운 일정','2026-06-09','11:30','12:00',NULL,NULL,1,'confirmed','2026-06-09 13:25:46','2026-06-09 13:25:46');
INSERT INTO reservations VALUES(46,'WYLIE',1,2,'새로운 일정','2026-06-10','07:30','08:00',NULL,NULL,1,'cancelled','2026-06-10 00:37:44','2026-06-10 07:31:22');
INSERT INTO reservations VALUES(47,'WYLIE',1,1,'V6-4 라우팅 테스트','2026-06-20','14:00','15:00',NULL,NULL,1,'confirmed','2026-06-10 01:08:23','2026-06-10 01:08:23');
INSERT INTO reservations VALUES(48,'WYLIE',1,8,'새로운 일정','2026-06-10','10:00','10:30',NULL,3,1,'cancelled','2026-06-10 01:39:03','2026-06-10 01:39:03');
INSERT INTO reservations VALUES(49,'WYLIE',1,8,'새로운 일정','2026-06-17','10:00','10:30',NULL,3,1,'cancelled','2026-06-10 01:39:03','2026-06-10 01:39:03');
INSERT INTO reservations VALUES(50,'WYLIE',1,3,'새로운 일정','2026-06-10','10:30','11:00',NULL,4,1,'cancelled','2026-06-10 01:43:45','2026-06-10 01:43:53');
INSERT INTO reservations VALUES(51,'WYLIE',1,3,'새로운 일정','2026-06-17','10:30','11:00',NULL,4,1,'cancelled','2026-06-10 01:43:45','2026-06-10 01:43:45');
INSERT INTO reservations VALUES(52,'WYLIE',1,1,'V7 일괄 적용 완료','2026-06-15','11:00','12:00',NULL,5,1,'cancelled','2026-06-10 02:05:20','2026-06-10 02:05:20');
INSERT INTO reservations VALUES(53,'WYLIE',1,1,'V7 일괄 적용 완료','2026-06-16','11:00','12:00',NULL,5,1,'cancelled','2026-06-10 02:05:20','2026-06-10 02:05:20');
INSERT INTO reservations VALUES(54,'WYLIE',1,1,'V7 일괄 적용 완료','2026-06-17','11:00','12:00',NULL,5,1,'cancelled','2026-06-10 02:05:20','2026-06-10 02:05:20');
INSERT INTO reservations VALUES(55,'WYLIE',18,3,'새로운 일정','2026-06-10','02:00','08:00',NULL,NULL,0,'cancelled','2026-06-10 02:18:55','2026-06-10 02:18:55');
INSERT INTO reservations VALUES(56,'WYLIE',18,4,'새로운 일정','2026-06-10','02:00','08:00',NULL,NULL,0,'cancelled','2026-06-10 02:18:58','2026-06-10 02:18:58');
INSERT INTO reservations VALUES(57,'WYLIE',18,1,'새로운 일정','2026-06-10','08:00','09:00',NULL,NULL,0,'cancelled','2026-06-10 02:19:43','2026-06-10 02:19:43');
INSERT INTO reservations VALUES(58,'WYLIE',18,2,'새로운 일정','2026-06-10','08:00','09:00',NULL,NULL,0,'cancelled','2026-06-10 02:19:45','2026-06-10 02:19:45');
INSERT INTO reservations VALUES(59,'WYLIE',18,3,'새로운 일정','2026-06-10','08:00','09:00',NULL,NULL,0,'cancelled','2026-06-10 02:19:47','2026-06-10 02:20:14');
INSERT INTO reservations VALUES(60,'WYLIE',18,6,'새로운 일정','2026-06-10','02:30','16:30',NULL,NULL,0,'cancelled','2026-06-10 02:19:59','2026-06-10 02:19:59');
INSERT INTO reservations VALUES(61,'WYLIE',18,7,'새로운 일정','2026-06-10','02:30','16:30',NULL,NULL,0,'cancelled','2026-06-10 02:20:02','2026-06-10 02:20:02');
INSERT INTO reservations VALUES(62,'LUSH',15,4,'새로운 일정','2026-06-10','17:30','22:00',NULL,NULL,1,'confirmed','2026-06-10 02:22:42','2026-06-10 08:54:26');
INSERT INTO reservations VALUES(63,'LUSH',15,2,'새로운 일정','2026-06-10','09:30','14:30',NULL,NULL,1,'cancelled','2026-06-10 02:22:44','2026-06-10 02:22:44');
INSERT INTO reservations VALUES(64,'LUSH',15,3,'새로운 일정','2026-06-10','11:30','16:30',NULL,NULL,1,'cancelled','2026-06-10 02:22:50','2026-06-10 02:22:50');
INSERT INTO reservations VALUES(65,'LUSH',15,4,'새로운 일정','2026-06-10','12:00','17:30',NULL,NULL,1,'cancelled','2026-06-10 02:22:52','2026-06-10 02:22:52');
INSERT INTO reservations VALUES(66,'LUSH',15,5,'새로운 일정','2026-06-10','02:30','10:30',NULL,6,1,'cancelled','2026-06-10 02:29:09','2026-06-10 02:29:09');
INSERT INTO reservations VALUES(67,'LUSH',15,5,'새로운 일정','2026-06-17','02:30','10:30',NULL,6,1,'cancelled','2026-06-10 02:29:09','2026-06-10 02:29:09');
INSERT INTO reservations VALUES(68,'LUSH',15,5,'새로운 일정','2026-06-24','02:30','10:30',NULL,6,1,'cancelled','2026-06-10 02:29:09','2026-06-10 02:29:09');
INSERT INTO reservations VALUES(69,'WYLIE',127,5,'새로운 일정','2026-06-10','14:00','18:00',NULL,NULL,0,'cancelled','2026-06-10 04:47:37','2026-06-10 04:47:37');
INSERT INTO reservations VALUES(70,'WYLIE',127,8,'새로운 일정','2026-06-10','09:30','10:00',NULL,NULL,0,'cancelled','2026-06-10 04:47:44','2026-06-10 04:47:44');
INSERT INTO reservations VALUES(71,'WYLIE',17,3,'새로운 일정','2026-06-10','02:30','07:30',NULL,NULL,0,'cancelled','2026-06-10 04:50:05','2026-06-10 04:50:05');
INSERT INTO reservations VALUES(72,'WYLIE',17,4,'새로운 일정','2026-06-10','02:30','08:00',NULL,NULL,0,'cancelled','2026-06-10 04:50:08','2026-06-10 04:50:08');
INSERT INTO reservations VALUES(73,'WYLIE',17,8,'새로운 일정','2026-06-10','02:00','09:00',NULL,NULL,0,'cancelled','2026-06-10 04:50:14','2026-06-10 04:50:14');
INSERT INTO reservations VALUES(74,'WYLIE',17,6,'새로운 일정','2026-06-10','02:00','10:00',NULL,NULL,0,'cancelled','2026-06-10 04:50:17','2026-06-10 04:50:17');
INSERT INTO reservations VALUES(75,'WYLIE',1,4,'새로운 일정','2026-06-10','02:30','08:00',NULL,NULL,1,'cancelled','2026-06-10 04:53:21','2026-06-10 07:29:05');
INSERT INTO reservations VALUES(76,'WYLIE',17,5,'새로운 일정','2026-06-10','07:00','07:30',NULL,NULL,0,'cancelled','2026-06-10 04:53:47','2026-06-10 07:28:49');
INSERT INTO reservations VALUES(77,'WYLIE',17,5,'새로운 일정','2026-06-10','12:30','19:00',NULL,NULL,0,'cancelled','2026-06-10 04:53:49','2026-06-10 04:53:49');
INSERT INTO reservations VALUES(78,'WYLIE',17,2,'새로운 일정','2026-06-10','17:00','22:00',NULL,NULL,0,'cancelled','2026-06-10 04:53:50','2026-06-10 04:53:50');
INSERT INTO reservations VALUES(79,'WYLIE',17,3,'새로운 일정','2026-06-10','19:30','22:30',NULL,NULL,0,'cancelled','2026-06-10 04:53:51','2026-06-10 04:53:51');
INSERT INTO reservations VALUES(80,'WYLIE',17,4,'새로운 일정','2026-06-10','19:00','23:30',NULL,NULL,0,'cancelled','2026-06-10 04:53:53','2026-06-10 04:54:18');
INSERT INTO reservations VALUES(81,'WYLIE',17,3,'새로운 일정','2026-06-10','17:00','22:00',NULL,NULL,0,'confirmed','2026-06-10 04:53:54','2026-06-10 08:54:21');
INSERT INTO reservations VALUES(82,'WYLIE',17,3,'새로운 일정','2026-06-10','08:30','09:30',NULL,NULL,0,'cancelled','2026-06-10 04:54:45','2026-06-10 04:54:45');
INSERT INTO reservations VALUES(83,'WYLIE',17,1,'새로운 일정','2026-06-10','10:00','12:30',NULL,NULL,0,'cancelled','2026-06-10 04:54:51','2026-06-10 04:54:51');
INSERT INTO reservations VALUES(85,'WYLIE',17,2,'새로운 일정','2026-06-10','00:00','01:00',NULL,NULL,0,'cancelled','2026-06-10 06:10:15','2026-06-10 07:31:16');
INSERT INTO reservations VALUES(86,'WYLIE',1,5,'V10§7테스트','2026-06-10','19:30','21:00',NULL,NULL,1,'cancelled','2026-06-10 07:24:26','2026-06-10 07:24:36');
INSERT INTO reservations VALUES(87,'WYLIE',1,5,'새로운 일정','2026-06-10','09:30','11:30',NULL,NULL,1,'cancelled','2026-06-10 07:29:01','2026-06-10 07:29:20');
INSERT INTO reservations VALUES(88,'WYLIE',1,2,'새로운 일정','2026-06-10','08:00','08:30',NULL,NULL,1,'confirmed','2026-06-10 09:05:25','2026-06-10 09:05:29');
INSERT INTO reservations VALUES(90,'WYLIE',1,2,'새로운 일정','2026-06-10','02:00','07:30',NULL,NULL,1,'confirmed','2026-06-10 09:10:54','2026-06-10 09:10:54');
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO sessions VALUES('beb8e9a9bc38aa323b1d41b1919cde129bce533fe1b4260d4137abb3a9dad28a',1,'2026-06-16T08:28:00.948Z','2026-06-09 08:28:00');
INSERT INTO sessions VALUES('75f3918c0c285ccf5298a91bff3ff295902b427a1e1cdc1424fe79b6c6a9eaaa',1,'2026-06-16T09:00:26.861Z','2026-06-09 09:00:26');
INSERT INTO sessions VALUES('e96f4613f34f5dad5f101adfa71e22e5eeb0dcedf61286305e8c2e134d942f25',1,'2026-06-16T09:02:21.328Z','2026-06-09 09:02:21');
INSERT INTO sessions VALUES('0c1d6c189145d95843a5e49636eade0038c0025b9791b5e3335802009f6a9b93',1,'2026-06-16T09:02:32.568Z','2026-06-09 09:02:32');
INSERT INTO sessions VALUES('e18d80c59f71c7b6fe7cd2b3b53bba5b2ce541fa788d7f62824a6f278a738e45',1,'2026-06-16T09:09:36.607Z','2026-06-09 09:09:36');
INSERT INTO sessions VALUES('1b71820fe851d98a522f2c1ddda30d1338d8044536c71d3b9038c6081c3356e1',1,'2026-06-16T09:11:30.323Z','2026-06-09 09:11:30');
INSERT INTO sessions VALUES('ca6fd0cf94e5603e52655a7555b5f9d07adb72ed9626ad5a1b427a608eed0a43',1,'2026-06-16T09:12:21.031Z','2026-06-09 09:12:21');
INSERT INTO sessions VALUES('f24dc3614936777b4895f0bd9a4f5a550f2b026830783cc304cd354ade402f9b',1,'2026-06-16T09:12:38.966Z','2026-06-09 09:12:38');
INSERT INTO sessions VALUES('43f83733d95a932c679b665341be71b7fde8abb9205c6d90e9d211fc630e355a',1,'2026-06-16T09:12:53.759Z','2026-06-09 09:12:53');
INSERT INTO sessions VALUES('6f041b64df295926ae40eddae15a987c14723848cf2b2769e71291fd11b13b3b',1,'2026-06-16T09:13:12.004Z','2026-06-09 09:13:12');
INSERT INTO sessions VALUES('8066f9f63ae94d052d347b327e409cced82d160ead14873654283d240708033e',1,'2026-06-16T09:13:27.570Z','2026-06-09 09:13:27');
INSERT INTO sessions VALUES('440b6d4a1248f8ec5cc447875114c150f2c250598834c6de9c03031ce0120eb3',1,'2026-06-16T09:56:28.538Z','2026-06-09 09:56:28');
INSERT INTO sessions VALUES('f83a9c2090277a2e655ca31c553ea668c224b4cc472967adbb77512ef7562aea',1,'2026-06-16T09:57:53.679Z','2026-06-09 09:57:53');
INSERT INTO sessions VALUES('30ae8c8e801282ac20659d8d559458fe89968b47d02416730d70796b6ce9ef7c',1,'2026-06-16T09:58:16.509Z','2026-06-09 09:58:16');
INSERT INTO sessions VALUES('8e3697876f828fd74427a7ffb3b19d213d349e9ae9ba338723872725ac8ea719',1,'2026-06-16T09:58:17.038Z','2026-06-09 09:58:17');
INSERT INTO sessions VALUES('d9668c7a24923fba5a04c43a5c227ba4de289c26af1d7e98ae051b10b84e9b60',1,'2026-06-16T09:58:17.170Z','2026-06-09 09:58:17');
INSERT INTO sessions VALUES('d27392c3d82e6064de62b829f470f8b10cd56d7a9af1b9e750c9e70ce1f19a9d',1,'2026-06-16T12:18:52.356Z','2026-06-09 12:18:52');
INSERT INTO sessions VALUES('df91110f3166f80f0e2059f0a418008fb0a0ad183619f7b283b1eb517f2cd75d',15,'2026-06-16T12:59:12.899Z','2026-06-09 12:59:12');
INSERT INTO sessions VALUES('c724847ff6df558e646129b9916182434f635be17f18d6fd139f9a4c331c2b7a',1,'2026-06-16T12:59:13.152Z','2026-06-09 12:59:13');
INSERT INTO sessions VALUES('0479baba84922aa9e76148d9f59baa42f6d9d9be7f310e54f155509a2ae9b1c9',1,'2026-06-16T13:02:30.935Z','2026-06-09 13:02:30');
INSERT INTO sessions VALUES('1615a49a985e921ded3a3617fc963277c1c52afb20c1962f6e4186cee8be7e1b',15,'2026-06-16T13:02:33.014Z','2026-06-09 13:02:33');
INSERT INTO sessions VALUES('84d327175be5666584d9aabced4420cb51837b2a91b11381227ec5cd962fc95e',1,'2026-06-17T00:33:21.655Z','2026-06-10 00:33:21');
INSERT INTO sessions VALUES('0639cdcf2bd0dfcf263522522d25c26b16d0b81b12516df873198f1e74610cb4',1,'2026-06-17T00:36:40.315Z','2026-06-10 00:36:40');
INSERT INTO sessions VALUES('0b071299760edb15de7a026f2341c71c92549dea09bee479a02e5d4ccebaf832',1,'2026-06-17T00:57:34.971Z','2026-06-10 00:57:35');
INSERT INTO sessions VALUES('108894024cd4a9138768bd064f53e8f805418ed612004784516e7ddc6b5b3136',15,'2026-06-17T00:57:35.188Z','2026-06-10 00:57:35');
INSERT INTO sessions VALUES('e3d0101661a1896ce981804ee33eced1fe19387b3a5180f44748be123e2e5c6d',1,'2026-06-17T01:07:27.426Z','2026-06-10 01:07:27');
INSERT INTO sessions VALUES('f637841eb535eee0ab61ecadb3c1ccf55706031b5698e33884589e041479a346',1,'2026-06-17T01:07:47.132Z','2026-06-10 01:07:47');
INSERT INTO sessions VALUES('185e31bb58e93f0747e7146aca53c87f804be1fa337db576d0f8222a014252a1',15,'2026-06-17T01:07:47.719Z','2026-06-10 01:07:47');
INSERT INTO sessions VALUES('6552247fa101f6dd60856959f23949e2bb8844a707355ad456975e99ed7bd984',1,'2026-06-17T01:07:47.804Z','2026-06-10 01:07:47');
INSERT INTO sessions VALUES('d01cb0335a95a8576fb7fe99b6fce7a08bff8de59c2d3ef769ea15ee6a870f1e',1,'2026-06-17T01:08:03.476Z','2026-06-10 01:08:03');
INSERT INTO sessions VALUES('1ed08df52c3696b9fbe5b15b876a49a8a5fc030d397aec265afa411e013f7393',1,'2026-06-17T01:10:21.790Z','2026-06-10 01:10:21');
INSERT INTO sessions VALUES('a1417fa9dfa03cfdada227da0de8b17cef747f785d195ba856f83cdef2eee3bb',15,'2026-06-17T01:10:22.480Z','2026-06-10 01:10:22');
INSERT INTO sessions VALUES('516900c176dddc072aa87bd1958e9b54220ec6ff826d53c340086f926e9adcf7',1,'2026-06-17T01:26:39.127Z','2026-06-10 01:26:39');
INSERT INTO sessions VALUES('0bdf2f05d1c60dcaf17ea03654bb9f6a04fe516fa2bd0662a8c7d94e9a0a6cb1',1,'2026-06-17T01:26:39.173Z','2026-06-10 01:26:39');
INSERT INTO sessions VALUES('fd0a793164bca4bfaa8f6226cdece5bb1a80005260cfe75d1da195174e76ccd5',1,'2026-06-17T01:26:39.949Z','2026-06-10 01:26:39');
INSERT INTO sessions VALUES('c288254b9b97d3796963f455faab7ac80db2f82923e120fea54708a0db3ad744',1,'2026-06-17T01:26:40.079Z','2026-06-10 01:26:40');
INSERT INTO sessions VALUES('f857bd1acedade5ab660e019a384618a6b74c4b122609ebcc525093580232f99',1,'2026-06-17T02:04:24.039Z','2026-06-10 02:04:24');
INSERT INTO sessions VALUES('4990e27b1ddede019ec977897ca98ba4b022cc7e1f284f2f87d72b14499088ad',1,'2026-06-17T02:47:59.296Z','2026-06-10 02:47:59');
INSERT INTO sessions VALUES('1a742949023abea5b47a14beb242a5158f0f8468cfeecf9de06b5e302fa5cd21',1,'2026-06-17T03:46:30.815Z','2026-06-10 03:46:30');
INSERT INTO sessions VALUES('53af4b26420dcb1027a0455203fb58d1fb7a435efc404a6ed398e0f16a3eb81d',1,'2026-06-17T04:02:24.023Z','2026-06-10 04:02:24');
INSERT INTO sessions VALUES('390fe7e10f38b1f55ef1137b8245031888d77507903ac0bc47a1875a557b5208',127,'2026-06-17T04:46:38.315Z','2026-06-10 04:46:38');
INSERT INTO sessions VALUES('2e5e16000d6fe00fbd22af35650597d2738e96391be4780d4ed1b710e893b6bf',1,'2026-06-17T05:53:06.644Z','2026-06-10 05:53:06');
INSERT INTO sessions VALUES('d3c32d787454571782603c7a845a11bb092680dfcd1ea8a75b529f08eb587cda',48,'2026-06-17T05:57:05.307Z','2026-06-10 05:57:05');
INSERT INTO sessions VALUES('dc919648d393951f6380ca1e0043e65456f6cb1c4fdbe9b1027fb5773cea6aee',1,'2026-06-17T07:22:38.686Z','2026-06-10 07:22:38');
INSERT INTO sessions VALUES('fc3c4bfd63265df3634cbcdb10bf8fdd4e248d29027f59d24a07353c03aaae6a',1,'2026-06-17T07:34:45.100Z','2026-06-10 07:34:45');
INSERT INTO sessions VALUES('2070d26a214694d39b253fa4f9a501f985b70cb1fb92525f199d736bd512473f',1,'2026-06-17T08:40:37.932Z','2026-06-10 08:40:37');
INSERT INTO sessions VALUES('68c49ed8b6139a9d09d7d6b891ea1cfb617e853d5894c9fda1852a06f3b7803e',9999,'2026-06-17T08:40:53.757Z','2026-06-10 08:40:53');
INSERT INTO sessions VALUES('f44d17ecc26b7af8692e4a45e16002d0a7d21db0954047e610d842a8a1a41b5e',1,'2026-06-17T09:06:10.514Z','2026-06-10 09:06:10');
INSERT INTO sessions VALUES('326f11b6df9156b51c05d7b4e15217fc73980c3699e3bbe4f90bb608e09b80f2',1,'2026-06-17T09:09:49.661Z','2026-06-10 09:09:49');
INSERT INTO sessions VALUES('f766bba38b1bc142ec435988c3fb6ce2edbc3e810054ebb65f4decc560950b0d',9999,'2026-06-17T09:09:49.765Z','2026-06-10 09:09:49');
CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, name)
);
INSERT INTO departments VALUES(8,'WYLIE','컨버전스 1본부',1,'2026-06-10 04:23:31');
INSERT INTO departments VALUES(9,'WYLIE','컨버전스 2본부',2,'2026-06-10 04:23:35');
INSERT INTO departments VALUES(10,'WYLIE','컨버전스 3본부',3,'2026-06-10 04:23:39');
INSERT INTO departments VALUES(11,'WYLIE','플랫폼운영본부',4,'2026-06-10 04:23:44');
INSERT INTO departments VALUES(12,'WYLIE','마케팅캠페인본부',5,'2026-06-10 04:23:50');
INSERT INTO departments VALUES(13,'WYLIE','신성장사업본부',6,'2026-06-10 04:23:53');
INSERT INTO departments VALUES(14,'WYLIE','퍼포먼스플랫폼본부',7,'2026-06-10 04:24:00');
INSERT INTO departments VALUES(15,'WYLIE','경영전략실',8,'2026-06-10 04:24:04');
INSERT INTO departments VALUES(16,'WYLIE','인재전략실',9,'2026-06-10 04:24:08');
INSERT INTO departments VALUES(17,'WYLIE','AX혁신센터',10,'2026-06-10 04:24:24');
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, name)
);
INSERT INTO positions VALUES(2,'WYLIE','GM',1,'2026-06-10 03:36:06');
INSERT INTO positions VALUES(3,'WYLIE','GL',2,'2026-06-10 03:36:11');
INSERT INTO positions VALUES(5,'WYLIE','GA',4,'2026-06-10 04:24:30');
INSERT INTO positions VALUES(6,'WYLIE','GH',5,'2026-06-10 04:24:47');
INSERT INTO positions VALUES(7,'WYLIE','GP',6,'2026-06-10 04:24:50');
CREATE TABLE reservation_attendees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL,
  member_id       INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  invited_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at    DATETIME,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)      REFERENCES users(id)        ON DELETE CASCADE,
  UNIQUE (reservation_id, member_id)
);
INSERT INTO reservation_attendees VALUES(3,85,127,'PENDING','2026-06-10 06:10:15',NULL);
INSERT INTO reservation_attendees VALUES(4,85,74,'PENDING','2026-06-10 06:10:15',NULL);
INSERT INTO reservation_attendees VALUES(5,85,77,'PENDING','2026-06-10 06:10:15',NULL);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('d1_migrations',5);
INSERT INTO sqlite_sequence VALUES('spaces',9);
INSERT INTO sqlite_sequence VALUES('users',9999);
INSERT INTO sqlite_sequence VALUES('reservations',90);
INSERT INTO sqlite_sequence VALUES('recurring_rules',6);
INSERT INTO sqlite_sequence VALUES('departments',17);
INSERT INTO sqlite_sequence VALUES('positions',7);
INSERT INTO sqlite_sequence VALUES('reservation_attendees',5);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_reservations_date_space ON reservations(date, space_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_departments_tenant ON departments(tenant_id);
CREATE INDEX idx_positions_tenant ON positions(tenant_id);
CREATE INDEX idx_resv_attendees_member
  ON reservation_attendees (member_id, status);
CREATE INDEX idx_resv_attendees_reservation
  ON reservation_attendees (reservation_id);
COMMIT;
