'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import AdminUsersPanel from './components/AdminUsersPanel';
import AdminEvalCreatePanel from './components/AdminEvalCreatePanel';
import AdminEvalReviewPanel from './components/AdminEvalReviewPanel';
import HomePanel from './components/HomePanel';
import AnnouncementsPanel from './components/AnnouncementsPanel';

const VIEW_TITLES = {
  home: '홈',
  announcements: '공지사항',
  checklist: '체크리스트',
  yearly: '연도별 기록',
  lawsearch: '법령검색',
  templates: '양식함',
  adminUsers: '회원 관리',
  evalCreate: '평가생성',
  evalReview: '평가검토',
};

const VIEW_ICONS = {
  home: '🏠',
  announcements: '📢',
  checklist: '📋',
  yearly: '📅',
  lawsearch: '⚖️',
  templates: '📁',
  adminUsers: '🛡️',
  evalCreate: '🏗️',
  evalReview: '📝',
};

const PERIODS = [
  { key: 'daily', label: '일일', unit: '매일' },
  { key: 'weekly', label: '주간', unit: '매주' },
  { key: 'monthly', label: '월간', unit: '매월' },
  { key: 'quarterly', label: '분기', unit: '분기마다' },
  { key: 'semiannual', label: '반기', unit: '반기마다' },
  { key: 'annual', label: '연간', unit: '매년' },
];

const DEFAULT_ITEMS = [
  { period: 'daily', name: '작업 전 안전점검회의(TBM) 실시 및 일지 작성' },
  { period: 'daily', name: '당일 작업 위험성평가 확인 및 근로자 공유' },
  { period: 'daily', name: '개인보호구(PPE) 지급·착용 상태 확인' },
  { period: 'daily', name: '작업장 정리정돈 및 이상유무 점검' },
  { period: 'weekly', name: '안전보건관리(감독)자 현장 순회점검 실시' },
  { period: 'weekly', name: '유해·위험요인 개선조치 이행 확인' },
  { period: 'weekly', name: '중장비·설비 점검일지 확인' },
  { period: 'monthly', name: '정기 안전보건교육 실시(관리감독자·근로자)' },
  { period: 'monthly', name: '소방시설·화재예방 점검' },
  { period: 'monthly', name: '안전보건관리규정 준수 여부 점검' },
  { period: 'quarterly', name: '산업안전보건위원회(또는 노사협의체) 개최' },
  { period: 'quarterly', name: 'MSDS(물질안전보건자료) 비치·갱신 확인' },
  { period: 'semiannual', name: '중대재해처벌법 안전보건관리체계 이행 점검(유해위험요인 확인·개선 절차)' },
  { period: 'semiannual', name: '도급·용역·위탁 시 수급업체 안전보건 확보조치 점검' },
  { period: 'semiannual', name: '안전·보건 관계 법령상 의무이행 점검(인력·예산 편성 포함)' },
  { period: 'annual', name: '안전보건관리계획 수립 및 예산 편성' },
  { period: 'annual', name: '경영책임자 안전보건 목표·경영방침 수립' },
  { period: 'annual', name: '근로자 일반건강진단 실시' },
  { period: 'annual', name: '비상대응(재해대응)계획 수립 및 점검' },
];

const LAW_INDEX = {
  '산업안전보건법': [
    {
      no: '제5조', title: '사업주 등의 의무',
      text: `① 사업주(제77조에 따른 특수형태근로종사자로부터 노무를 제공받는 자와 제78조에 따른 물건의 수거·배달 등을 중개하는 자를 포함한다)는 다음 각 호의 사항을 이행함으로써 근로자의 안전 및 건강을 유지·증진시키고 국가의 산업재해 예방정책을 따라야 한다.
1. 이 법과 이 법에 따른 명령으로 정하는 산업재해 예방을 위한 기준
2. 근로자의 신체적 피로와 정신적 스트레스 등을 줄일 수 있는 쾌적한 작업환경의 조성 및 근로조건 개선
3. 해당 사업장의 안전 및 보건에 관한 정보를 근로자에게 제공

② 다음 각 호의 어느 하나에 해당하는 자는 설계·제조·수입 또는 건설을 할 때 이 법과 이 법에 따른 명령으로 정하는 기준을 지켜야 하고, 그 물건을 사용함으로 인하여 발생하는 산업재해를 방지하기 위하여 필요한 조치를 하여야 한다.
1. 기계·기구와 그 밖의 설비를 설계·제조 또는 수입하는 자
2. 원재료 등을 제조·수입하는 자
3. 건설물을 설계·건설하는 자`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제14조', title: '이사회 보고 및 승인 등',
      text: `① 「상법」 제170조에 따른 주식회사 중 대통령령으로 정하는 회사의 대표이사는 대통령령으로 정하는 바에 따라 매년 회사의 안전 및 보건에 관한 계획을 수립하여 이사회에 보고하고 승인을 받아야 한다.
② 제1항에 따른 대표이사는 제1항에 따른 안전 및 보건에 관한 계획을 성실하게 이행하여야 한다.
③ 제1항에 따른 안전 및 보건에 관한 계획에는 안전 및 보건에 관한 비용, 시설, 인원 등의 사항을 포함하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제15조', title: '안전보건관리책임자',
      text: `① 사업주는 사업장을 실질적으로 총괄하여 관리하는 사람에게 해당 사업장의 다음 각 호의 업무를 총괄하여 관리하도록 하여야 한다.
1. 사업장의 산업재해 예방계획의 수립에 관한 사항
2. 제25조 및 제26조에 따른 안전보건관리규정의 작성 및 변경에 관한 사항
3. 제29조에 따른 안전보건교육에 관한 사항
4. 작업환경측정 등 작업환경의 점검 및 개선에 관한 사항
5. 제129조부터 제132조까지에 따른 근로자의 건강진단 등 건강관리에 관한 사항

② 제1항 각 호의 업무를 총괄하여 관리하는 사람(이하 "안전보건관리책임자"라 한다)은 제17조에 따른 안전관리자와 제18조에 따른 보건관리자를 지휘·감독한다.
③ 안전보건관리책임자를 두어야 하는 사업의 종류와 사업장의 상시근로자 수, 그 밖에 필요한 사항은 대통령령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제16조', title: '관리감독자',
      text: `① 사업주는 사업장의 생산과 관련되는 업무와 그 소속 직원을 직접 지휘·감독하는 직위에 있는 사람(이하 "관리감독자"라 한다)에게 산업 안전 및 보건에 관한 업무로서 대통령령으로 정하는 업무를 수행하도록 하여야 한다.
② 관리감독자가 있는 경우에는 「건설기술 진흥법」 제64조제1항제2호에 따른 안전관리책임자 및 같은 항 제3호에 따른 안전관리담당자를 각각 둔 것으로 본다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제17조', title: '안전관리자',
      text: `① 사업주는 사업장에 제15조제1항 각 호의 사항 중 안전에 관한 기술적인 사항에 관하여 사업주 또는 안전보건관리책임자를 보좌하고 관리감독자에게 지도·조언하는 업무를 수행하는 사람(이하 "안전관리자"라 한다)을 두어야 한다.
② 안전관리자를 두어야 하는 사업의 종류와 사업장의 상시근로자 수, 안전관리자의 수·자격·업무·권한·선임방법, 그 밖에 필요한 사항은 대통령령으로 정한다.
③ 대통령령으로 정하는 사업의 종류 및 사업장의 상시근로자 수에 해당하는 사업장의 사업주는 안전관리자에게 그 업무만을 전담하도록 하여야 한다.
④ 고용노동부장관은 산업재해 예방을 위하여 필요한 경우로서 고용노동부령으로 정하는 사유에 해당하는 경우에는 사업주에게 안전관리자를 제2항에 따라 대통령령으로 정하는 수 이상으로 늘리거나 교체할 것을 명할 수 있다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제18조', title: '보건관리자',
      text: `① 사업주는 사업장에 제15조제1항 각 호의 사항 중 보건에 관한 기술적인 사항에 관하여 사업주 또는 안전보건관리책임자를 보좌하고 관리감독자에게 지도·조언하는 업무를 수행하는 사람(이하 "보건관리자"라 한다)을 두어야 한다.
② 보건관리자를 두어야 하는 사업의 종류와 사업장의 상시근로자 수, 보건관리자의 수·자격·업무·권한·선임방법, 그 밖에 필요한 사항은 대통령령으로 정한다.
③ 대통령령으로 정하는 사업의 종류 및 사업장의 상시근로자 수에 해당하는 사업장의 사업주는 보건관리자에게 그 업무만을 전담하도록 하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제19조', title: '안전보건관리담당자',
      text: `① 사업주는 사업장에 안전 및 보건에 관하여 사업주를 보좌하고 관리감독자에게 지도·조언하는 업무를 수행하는 사람(이하 "안전보건관리담당자"라 한다)을 두어야 한다. 다만, 안전관리자 또는 보건관리자가 있거나 이를 두어야 하는 경우에는 그러하지 아니하다.
② 안전보건관리담당자를 두어야 하는 사업의 종류와 사업장의 상시근로자 수, 안전보건관리담당자의 수·자격·업무·권한·선임방법, 그 밖에 필요한 사항은 대통령령으로 정한다.
③ 고용노동부장관은 산업재해 예방을 위하여 필요한 경우로서 고용노동부령으로 정하는 사유에 해당하는 경우에는 사업주에게 안전보건관리담당자를 제2항에 따라 대통령령으로 정하는 수 이상으로 늘리거나 교체할 것을 명할 수 있다.
④ 대통령령으로 정하는 사업의 종류 및 사업장의 상시근로자 수에 해당하는 사업장의 사업주는 안전관리전문기관 또는 보건관리전문기관에 안전보건관리담당자의 업무를 위탁할 수 있다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제24조', title: '산업안전보건위원회',
      text: `① 사업주는 사업장의 안전 및 보건에 관한 중요 사항을 심의·의결하기 위하여 사업장에 근로자위원과 사용자위원이 같은 수로 구성되는 산업안전보건위원회를 구성·운영하여야 한다.
② 사업주는 다음 각 호의 사항에 대해서는 산업안전보건위원회의 심의·의결을 거쳐야 한다.
1. 제15조제1항제1호부터 제5호까지 및 제7호에 관한 사항
2. 제15조제1항제6호에 따른 사항 중 중대재해에 관한 사항
3. 유해하거나 위험한 기계·기구·설비를 도입한 경우 안전 및 보건 관련 조치에 관한 사항
4. 그 밖에 해당 사업장 근로자의 안전 및 보건을 유지·증진시키기 위하여 필요한 사항

③ 산업안전보건위원회는 대통령령으로 정하는 바에 따라 회의를 개최하고 그 결과를 회의록으로 작성하여 보존하여야 한다.
④ 사업주와 근로자는 제2항에 따라 산업안전보건위원회가 심의·의결한 사항을 성실하게 이행하여야 한다.
⑤ 산업안전보건위원회는 이 법, 이 법에 따른 명령, 단체협약, 취업규칙 및 제25조에 따른 안전보건관리규정에 반하는 내용으로 심의·의결해서는 아니 된다.
⑥ 사업주는 산업안전보건위원회의 위원에게 직무 수행과 관련한 사유로 불리한 처우를 해서는 아니 된다.
⑦ 산업안전보건위원회를 구성하여야 할 사업의 종류 및 사업장의 상시근로자 수, 산업안전보건위원회의 구성·운영 및 의결되지 아니한 경우의 처리방법, 그 밖에 필요한 사항은 대통령령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제25조', title: '안전보건관리규정의 작성',
      text: `① 사업주는 사업장의 안전 및 보건을 유지하기 위하여 다음 각 호의 사항이 포함된 안전보건관리규정을 작성하여야 한다.
1. 안전 및 보건에 관한 관리조직과 그 직무에 관한 사항
2. 안전보건교육에 관한 사항
3. 작업장의 안전 및 보건 관리에 관한 사항
4. 사고 조사 및 대책 수립에 관한 사항
5. 그 밖에 안전 및 보건에 관한 사항

② 제1항에 따른 안전보건관리규정(이하 "안전보건관리규정"이라 한다)은 단체협약 또는 취업규칙에 반할 수 없다. 이 경우 안전보건관리규정 중 단체협약 또는 취업규칙에 반하는 부분에 관하여는 그 단체협약 또는 취업규칙으로 정한 기준에 따른다.
③ 안전보건관리규정을 작성하여야 할 사업의 종류, 사업장의 상시근로자 수 및 안전보건관리규정에 포함되어야 할 세부적인 내용, 그 밖에 필요한 사항은 고용노동부령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제29조', title: '근로자에 대한 안전보건교육',
      text: `① 사업주는 소속 근로자에게 고용노동부령으로 정하는 바에 따라 정기적으로 안전보건교육을 하여야 한다.
② 사업주는 근로자를 채용할 때와 작업내용을 변경할 때에는 그 근로자에게 고용노동부령으로 정하는 바에 따라 해당 작업에 필요한 안전보건교육을 하여야 한다. 다만, 제31조제1항에 따른 안전보건교육을 이수한 건설 일용근로자를 채용하는 경우에는 그러하지 아니하다.
③ 사업주는 근로자를 유해하거나 위험한 작업에 채용하거나 그 작업으로 작업내용을 변경할 때에는 제2항에 따른 안전보건교육 외에 고용노동부령으로 정하는 바에 따라 유해하거나 위험한 작업에 필요한 안전보건교육을 추가로 하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제36조', title: '위험성평가의 실시',
      text: `① 사업주는 건설물, 기계·기구·설비, 원재료, 가스, 증기, 분진, 근로자의 작업행동 또는 그 밖의 업무로 인한 유해·위험 요인을 찾아내어 부상 및 질병으로 이어질 수 있는 위험성의 크기가 허용 가능한 범위인지를 평가하여야 하고, 그 결과에 따라 이 법과 이 법에 따른 명령에 따른 조치를 하여야 하며, 근로자에 대한 위험 또는 건강장해를 방지하기 위하여 필요한 경우에는 추가적인 조치를 하여야 한다.
② 사업주는 제1항에 따른 평가 시 고용노동부장관이 정하여 고시하는 바에 따라 해당 작업장의 근로자를 참여시켜야 한다.
③ 사업주는 제1항에 따른 평가의 결과와 조치사항을 고용노동부령으로 정하는 바에 따라 기록하여 보존하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제37조', title: '안전보건표지의 설치·부착',
      text: `① 사업주는 유해하거나 위험한 장소·시설·물질에 대한 경고, 비상시에 대처하기 위한 지시·안내 또는 그 밖에 근로자의 안전 및 보건 의식을 고취하기 위한 사항 등을 그림, 기호 및 글자 등으로 나타낸 표지(이하 이 조에서 "안전보건표지"라 한다)를 근로자가 쉽게 알아 볼 수 있도록 설치하거나 붙여야 한다. 이 경우 「외국인근로자의 고용 등에 관한 법률」 제2조에 따른 외국인근로자를 사용하는 사업주는 안전보건표지를 고용노동부장관이 정하는 바에 따라 해당 외국인근로자의 모국어로 작성하여야 한다.
② 안전보건표지의 종류, 형태, 색채, 용도 및 설치·부착 장소, 그 밖에 필요한 사항은 고용노동부령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제41조', title: '고객의 폭언등으로 인한 건강장해 예방조치',
      text: `① 사업주는 주로 고객을 직접 대면하거나 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제2조제1항제1호에 따른 정보통신망을 통하여 상대하면서 상품을 판매하거나 서비스를 제공하는 업무에 종사하는 고객응대근로자에 대하여 고객의 폭언, 폭행, 그 밖에 적정 범위를 벗어난 신체적·정신적 고통을 유발하는 행위(이하 이 조에서 "폭언등"이라 한다)로 인한 건강장해를 예방하기 위하여 고용노동부령으로 정하는 바에 따라 필요한 조치를 하여야 한다.
② 사업주는 업무와 관련하여 고객 등 제3자의 폭언등으로 근로자에게 건강장해가 발생하거나 발생할 현저한 우려가 있는 경우에는 업무의 일시적 중단 또는 전환 등 대통령령으로 정하는 필요한 조치를 하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제57조', title: '산업재해 발생 은폐 금지 및 보고 등',
      text: `① 사업주는 산업재해가 발생하였을 때에는 그 발생 사실을 은폐해서는 아니 된다.
② 사업주는 고용노동부령으로 정하는 바에 따라 산업재해의 발생 원인 등을 기록하여 보존하여야 한다.
③ 사업주는 고용노동부령으로 정하는 산업재해에 대해서는 그 발생 개요·원인 및 보고 시기, 재발방지 계획 등을 고용노동부령으로 정하는 바에 따라 고용노동부장관에게 보고하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제63조', title: '도급인의 안전조치 및 보건조치',
      text: `도급인은 관계수급인 근로자가 도급인의 사업장에서 작업을 하는 경우에 자신의 근로자와 관계수급인 근로자의 산업재해를 예방하기 위하여 안전 및 보건 시설의 설치 등 필요한 안전조치 및 보건조치를 하여야 한다. 다만, 보호구 착용의 지시 등 관계수급인 근로자의 작업행동에 관한 직접적인 조치는 제외한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제64조', title: '도급에 따른 산업재해 예방조치',
      text: `① 도급인은 관계수급인 근로자가 도급인의 사업장에서 작업을 하는 경우 다음 각 호의 사항을 이행하여야 한다.
1. 도급인과 수급인을 구성원으로 하는 안전 및 보건에 관한 협의체의 구성 및 운영
2. 작업장 순회점검
3. 관계수급인이 근로자에게 하는 안전보건교육을 위한 장소 및 자료의 제공 등 지원
4. 관계수급인이 근로자에게 하는 안전보건교육의 실시 확인
5. 다음 각 목의 어느 하나의 경우에 대비한 경보체계 운영과 대피방법 등 훈련
 가. 작업 장소에서 발파작업을 하는 경우
 나. 작업 장소에서 화재·폭발, 토사·구축물 등의 붕괴 또는 지진 등이 발생한 경우
6. 위생시설 등 고용노동부령으로 정하는 시설의 설치 등을 위하여 필요한 장소의 제공 또는 도급인이 설치한 위생시설 이용의 협조
7. 같은 장소에서 이루어지는 도급인과 관계수급인 등의 작업에 있어서 관계수급인 등의 작업시기·내용, 안전조치 및 보건조치 등의 확인
8. 제7호에 따른 확인 결과 관계수급인 등의 작업 혼재로 인하여 화재·폭발 등 대통령령으로 정하는 위험이 발생할 우려가 있는 경우 관계수급인 등의 작업시기·내용 등의 조정

② 제1항에 따른 도급인은 고용노동부령으로 정하는 바에 따라 자신의 근로자 및 관계수급인 근로자와 함께 정기적으로 또는 수시로 작업장의 안전 및 보건에 관한 점검을 하여야 한다.
③ 제1항에 따른 안전 및 보건에 관한 협의체 구성 및 운영, 작업장 순회점검, 안전보건교육 지원, 그 밖에 필요한 사항은 고용노동부령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제72조', title: '건설공사 등의 산업안전보건관리비 계상 등',
      text: `① 건설공사발주자가 도급계약을 체결하거나 건설공사의 시공을 주도하여 총괄·관리하는 자(건설공사발주자로부터 건설공사를 최초로 도급받은 수급인은 제외한다)가 건설공사 사업 계획을 수립할 때에는 고용노동부장관이 정하여 고시하는 바에 따라 산업재해 예방을 위하여 사용하는 비용(이하 "산업안전보건관리비"라 한다)을 도급금액 또는 사업비에 계상(計上)하여야 한다.
② 고용노동부장관은 산업안전보건관리비의 효율적인 사용을 위하여 필요한 사항을 정할 수 있다.
③ 건설공사도급인은 산업안전보건관리비를 제2항에서 정하는 바에 따라 사용하고 고용노동부령으로 정하는 바에 따라 그 사용명세서를 작성하여 보존하여야 한다.
④ 선박의 건조 또는 수리를 최초로 도급받은 수급인은 사업 계획을 수립할 때에는 고용노동부장관이 정하여 고시하는 바에 따라 산업안전보건관리비를 사업비에 계상하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제129조', title: '일반건강진단',
      text: `① 사업주는 상시 사용하는 근로자의 건강관리를 위하여 건강진단(이하 "일반건강진단"이라 한다)을 실시하여야 한다. 다만, 사업주가 고용노동부령으로 정하는 건강진단을 실시한 경우에는 그 건강진단을 받은 근로자에 대하여 일반건강진단을 실시한 것으로 본다.
② 사업주는 특수건강진단기관 또는 「건강검진기본법」 제3조제2호에 따른 건강검진기관(이하 "건강진단기관"이라 한다)에서 일반건강진단을 실시하여야 한다.
③ 일반건강진단의 주기·항목·방법 및 비용, 그 밖에 필요한 사항은 고용노동부령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제130조', title: '특수건강진단 등',
      text: `① 사업주는 다음 각 호의 어느 하나에 해당하는 근로자의 건강관리를 위하여 건강진단(이하 "특수건강진단"이라 한다)을 실시하여야 한다. 다만, 사업주가 고용노동부령으로 정하는 건강진단을 실시한 경우에는 그 건강진단을 받은 근로자에 대하여 해당 유해인자에 대한 특수건강진단을 실시한 것으로 본다.
1. 고용노동부령으로 정하는 유해인자에 노출되는 업무(이하 "특수건강진단대상업무"라 한다)에 종사하는 근로자
2. 제1호, 제3항 및 제131조에 따른 건강진단 실시 결과 직업병 소견이 있는 근로자로 판정받아 작업 전환을 하거나 작업 장소를 변경하여 해당 판정의 원인이 된 특수건강진단대상업무에 종사하지 아니하는 사람으로서 해당 유해인자에 대한 건강진단이 필요하다는 의사의 소견이 있는 근로자

② 사업주는 특수건강진단대상업무에 종사할 근로자의 배치 예정 업무에 대한 적합성 평가를 위하여 건강진단(이하 "배치전건강진단"이라 한다)을 실시하여야 한다. 다만, 고용노동부령으로 정하는 근로자에 대해서는 배치전건강진단을 실시하지 아니할 수 있다.
③ 사업주는 특수건강진단대상업무에 따른 유해인자로 인한 것이라고 의심되는 건강장해 증상을 보이거나 의학적 소견이 있는 근로자 중 보건관리자 등이 사업주에게 건강진단 실시를 건의하는 등 고용노동부령으로 정하는 근로자에 대하여 건강진단(이하 "수시건강진단"이라 한다)을 실시하여야 한다.
④ 사업주는 특수건강진단기관에서 제1항부터 제3항까지의 규정에 따른 건강진단을 실시하여야 한다.
⑤ 제1항부터 제3항까지의 규정에 따른 건강진단의 시기·주기·항목·방법 및 비용, 그 밖에 필요한 사항은 고용노동부령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
  ],
  '중대재해 처벌 등에 관한 법률': [
    {
      no: '제2조', title: '정의',
      text: `이 법에서 사용하는 용어의 뜻은 다음과 같다.
1. "중대재해"란 "중대산업재해"와 "중대시민재해"를 말한다.
2. "중대산업재해"란 「산업안전보건법」 제2조제1호에 따른 산업재해 중 다음 각 목의 어느 하나에 해당하는 결과를 야기한 재해를 말한다.
 가. 사망자가 1명 이상 발생
 나. 동일한 사고로 6개월 이상 치료가 필요한 부상자가 2명 이상 발생
 다. 동일한 유해요인으로 급성중독 등 대통령령으로 정하는 직업성 질병자가 1년 이내에 3명 이상 발생
3. "중대시민재해"란 특정 원료 또는 제조물, 공중이용시설 또는 공중교통수단의 설계, 제조, 설치, 관리상의 결함을 원인으로 하여 발생한 재해로서 다음 각 목의 어느 하나에 해당하는 결과를 야기한 재해를 말한다(중대산업재해는 제외).
 가. 사망자가 1명 이상 발생
 나. 동일한 사고로 2개월 이상 치료가 필요한 부상자가 10명 이상 발생
 다. 동일한 원인으로 3개월 이상 치료가 필요한 질병자가 10명 이상 발생
4.~6. "공중이용시설", "공중교통수단", "제조물"의 정의는 이 자리에서는 생략했어요 — 아래 law.go.kr 링크에서 확인해주세요.
7. "종사자"란 다음 각 목의 어느 하나에 해당하는 자를 말한다.
 가. 「근로기준법」상의 근로자
 나. 도급, 용역, 위탁 등 계약의 형식에 관계없이 그 사업의 수행을 위하여 대가를 목적으로 노무를 제공하는 자
 다. 사업이 여러 차례의 도급에 따라 행하여지는 경우에는 각 단계의 수급인 및 수급인과 가목 또는 나목의 관계가 있는 자
8. "사업주"란 자신의 사업을 영위하는 자, 타인의 노무를 제공받아 사업을 하는 자를 말한다.
9. "경영책임자등"이란 다음 각 목의 어느 하나에 해당하는 자를 말한다.
 가. 사업을 대표하고 사업을 총괄하는 권한과 책임이 있는 사람 또는 이에 준하여 안전·보건에 관한 업무를 담당하는 사람
 나. 중앙행정기관의 장, 지방자치단체의 장, 「지방공기업법」에 따른 지방공기업의 장, 「공공기관의 운영에 관한 법률」에 따라 지정된 공공기관의 장`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제3조', title: '적용범위',
      text: `상시 근로자가 5명 미만인 사업 또는 사업장의 사업주(개인사업주에 한정한다) 또는 경영책임자등에게는 이 장의 규정을 적용하지 아니한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제4조', title: '사업주와 경영책임자등의 안전 및 보건 확보의무',
      text: `① 사업주 또는 경영책임자등은 사업주나 법인 또는 기관이 실질적으로 지배·운영·관리하는 사업 또는 사업장에서 종사자의 안전·보건상 유해 또는 위험을 방지하기 위하여 그 사업 또는 사업장의 특성 및 규모 등을 고려하여 다음 각 호에 따른 조치를 하여야 한다.
1. 재해예방에 필요한 인력 및 예산 등 안전보건관리체계의 구축 및 그 이행에 관한 조치
2. 재해 발생 시 재발방지 대책의 수립 및 그 이행에 관한 조치
3. 중앙행정기관·지방자치단체가 관계 법령에 따라 개선, 시정 등을 명한 사항의 이행에 관한 조치
4. 안전·보건 관계 법령에 따른 의무이행에 필요한 관리상의 조치

② 제1항제1호·제4호의 조치에 관한 구체적인 사항은 대통령령으로 정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제5조', title: '도급, 용역, 위탁 등 관계에서의 안전 및 보건 확보의무',
      text: `사업주 또는 경영책임자등은 사업주나 법인 또는 기관이 제3자에게 도급, 용역, 위탁 등을 행한 경우에는 제3자의 종사자에게 중대산업재해가 발생하지 아니하도록 제4조의 조치를 하여야 한다. 다만, 사업주나 법인 또는 기관이 그 시설, 장비, 장소 등에 대하여 실질적으로 지배·운영·관리하는 책임이 있는 경우에 한정한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제6조', title: '중대산업재해 사업주와 경영책임자등의 처벌',
      text: `① 제4조 또는 제5조를 위반하여 제2조제2호가목의 중대산업재해에 이르게 한 사업주 또는 경영책임자등은 1년 이상의 징역 또는 10억원 이하의 벌금에 처한다. 이 경우 징역과 벌금을 병과할 수 있다.
② 제4조 또는 제5조를 위반하여 제2조제2호나목 또는 다목의 중대산업재해에 이르게 한 사업주 또는 경영책임자등은 7년 이하의 징역 또는 1억원 이하의 벌금에 처한다.
③ 제1항 또는 제2항의 죄로 형을 선고받고 그 형이 확정된 후 5년 이내에 다시 제1항 또는 제2항의 죄를 저지른 자는 각 항에서 정한 형의 2분의 1까지 가중한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제7조', title: '중대산업재해의 양벌규정',
      text: `법인 또는 기관의 경영책임자등이 그 법인 또는 기관의 업무에 관하여 제6조에 해당하는 위반행위를 하면 그 행위자를 벌하는 외에 그 법인 또는 기관에 다음 각 호의 구분에 따른 벌금형을 과(科)한다.
1. 제6조제1항의 경우: 50억원 이하의 벌금
2. 제6조제2항의 경우: 10억원 이하의 벌금`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제8조', title: '안전보건교육의 수강',
      text: `① 중대산업재해가 발생한 법인 또는 기관의 경영책임자등은 대통령령으로 정하는 바에 따라 안전보건교육을 이수하여야 한다.
② 제1항의 안전보건교육을 정당한 사유 없이 이행하지 아니한 경우에는 5천만원 이하의 과태료를 부과한다.
③ 제2항에 따른 과태료는 대통령령으로 정하는 바에 따라 고용노동부장관이 부과·징수한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제9조', title: '중대시민재해 사업주와 경영책임자등의 안전 및 보건 확보의무',
      text: `① 사업주 또는 경영책임자등은 사업주나 법인 또는 기관이 실질적으로 지배·운영·관리하는 사업 또는 사업장에서 생산·제조·판매·유통 중인 원료나 제조물의 설계, 제조, 관리상의 결함으로 인한 그 이용자 또는 그 밖의 사람의 생명, 신체의 안전을 위하여 다음 각 호에 따른 조치를 하여야 한다.
1. 재해예방에 필요한 인력·예산·점검 등 안전보건관리체계의 구축 및 그 이행에 관한 조치
2. 재해 발생 시 재발방지 대책의 수립 및 그 이행에 관한 조치
3. 중앙행정기관·지방자치단체가 관계 법령에 따라 개선, 시정 등을 명한 사항의 이행에 관한 조치
4. 안전·보건 관계 법령에 따른 의무이행에 필요한 관리상의 조치

② 사업주 또는 경영책임자등은 사업주나 법인 또는 기관이 실질적으로 지배·운영·관리하는 공중이용시설 또는 공중교통수단의 설계, 설치, 관리상의 결함으로 인한 그 이용자 또는 그 밖의 사람의 생명, 신체의 안전을 위하여 제1항 각 호에 따른 조치를 하여야 한다.`,
      lastChecked: '2026-07-23',
    },
    {
      no: '제10조', title: '중대시민재해 사업주와 경영책임자등의 처벌',
      text: `① 제9조를 위반하여 제2조제3호가목의 중대시민재해에 이르게 한 사업주 또는 경영책임자등은 1년 이상의 징역 또는 10억원 이하의 벌금에 처한다. 이 경우 징역과 벌금을 병과할 수 있다.
② 제9조를 위반하여 제2조제3호나목 또는 다목의 중대시민재해에 이르게 한 사업주 또는 경영책임자등은 7년 이하의 징역 또는 1억원 이하의 벌금에 처한다.`,
      lastChecked: '2026-07-23',
    },
  ],
  '산업안전보건법 시행규칙': [
    {
      no: '별표4', title: '안전보건교육 교육과정별 교육시간 (제26조제1항 등 관련)',
      text: `1. 근로자 안전보건교육
정기교육
 · 사무직 종사 근로자 — 매반기 6시간 이상
 · 판매업무에 직접 종사하는 근로자 — 매반기 6시간 이상
 · 판매업무 외 그 밖의 근로자 — 매반기 12시간 이상

채용 시 교육
 · 일용근로자 및 근로계약기간 1주 이하 기간제근로자 — 1시간 이상
 · 근로계약기간 1주 초과 1개월 이하 기간제근로자 — 4시간 이상
 · 그 밖의 근로자 — 8시간 이상

작업내용 변경 시 교육
 · 일용근로자 및 근로계약기간 1주 이하 기간제근로자 — 1시간 이상
 · 그 밖의 근로자 — 2시간 이상

특별교육 (별표5 제1호라목에 해당하는 유해·위험작업 종사자)
 · 일용근로자 및 근로계약기간 1주 이하 기간제근로자 — 2시간 이상
 · 타워크레인 신호작업 종사 일용근로자 — 8시간 이상
 · 그 밖의 근로자 — 16시간 이상 (최초 작업 종사 전 4시간 이상 실시, 나머지 12시간은 3개월 이내 분할 실시 가능), 단기간·간헐적 작업인 경우 2시간 이상

2. 관리감독자 안전보건교육 (2025.5.30 개정, 근로자 교육과 별도 항목으로 분리됨)
 · 정기교육 — 연간 16시간 이상
 · 채용 시 교육 — 8시간 이상
 · 작업내용 변경 시 교육 — 2시간 이상
 · 특별교육 — 16시간 이상 (최초 작업 전 4시간 이상, 나머지 12시간은 3개월 이내 분할 가능), 단기간·간헐적 작업은 2시간 이상

※ 구체적인 교육 "내용"(정기교육·특별교육에 각각 어떤 주제를 다뤄야 하는지)은 별표5에 40개 항목 넘게 나열되어 있어 이 앱에는 담지 않았어요. law.go.kr 링크에서 별표5를 확인해주세요.`,
      lastChecked: '2026-07-23',
    },
  ],
};

function lawSearchUrl(lawName, articleNo) {
  const q = `${lawName} ${articleNo}`;
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(q)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getCycleKey(period, d = new Date()) {
  // 주기(일일/주간/월간 등)와 상관없이, 연도 단위로만 초기화돼요.
  // 즉 한 번 완료 체크하면 그 해가 끝날 때까지 계속 완료 상태로 유지되고,
  // 새해가 되면 다시 미완료로 시작해요.
  return `${d.getFullYear()}`;
}

function cycleLabel(period) {
  const y = new Date().getFullYear();
  const map = {
    daily: `${y}년 일일 점검`,
    weekly: `${y}년 주간 점검`,
    monthly: `${y}년 월간 점검`,
    quarterly: `${y}년 분기 점검`,
    semiannual: `${y}년 반기 점검`,
    annual: `${y}년 연간 점검`,
  };
  return map[period] || `${y}년 점검`;
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function weeksInYear(year) {
  const key = getCycleKey('weekly', new Date(year, 11, 31));
  return parseInt(key.split('W')[1], 10) || 52;
}

function totalCyclesInYear(period, year) {
  if (period === 'daily') return isLeapYear(year) ? 366 : 365;
  if (period === 'weekly') return weeksInYear(year);
  if (period === 'monthly') return 12;
  if (period === 'quarterly') return 4;
  if (period === 'semiannual') return 2;
  if (period === 'annual') return 1;
  return 1;
}

function completedCyclesInYear(doneSet, year) {
  if (!doneSet) return 0;
  const prefix = String(year);
  let count = 0;
  doneSet.forEach(k => { if (k.startsWith(prefix)) count++; });
  return count;
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name || '');
}

function isPdfFile(name) {
  return /\.pdf$/i.test(name || '');
}

function DashboardInner() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [doneMap, setDoneMap] = useState({}); // itemId -> Set of cycleKeys done
  const [fileMap, setFileMap] = useState({}); // itemId -> { cycleKey: {path, name} }
  const [expandedItem, setExpandedItem] = useState(null); // item.id currently expanded
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [expandedYearlyItem, setExpandedYearlyItem] = useState(null); // item.id currently expanded in yearly view
  const [uploading, setUploading] = useState(null); // item.id currently uploading
  const [signedUrls, setSignedUrls] = useState({}); // path -> signed url
  const [active, setActive] = useState('daily');
  const [activeLawCategory, setActiveLawCategory] = useState(null); // set on first render from LAW_INDEX keys
  const [view, setView] = useState(() => searchParams.get('view') || 'home');
  const [openAnnouncementId, setOpenAnnouncementId] = useState(() => searchParams.get('id') || null);
  const isInternalNav = useRef(false);

  // 브라우저 뒤로가기/앞으로가기로 URL이 바뀌면 화면 상태를 맞춰줘요
  useEffect(() => {
    if (isInternalNav.current) {
      isInternalNav.current = false;
      return;
    }
    const urlView = searchParams.get('view') || 'home';
    const urlId = searchParams.get('id');
    setView(urlView);
    setOpenAnnouncementId(urlView === 'announcements' ? urlId : null);
  }, [searchParams]);
  const [homeExpanded, setHomeExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyPeriod, setYearlyPeriod] = useState('daily');
  const [expandedArticle, setExpandedArticle] = useState(null); // "lawName|articleNo"
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateCategory, setTemplateCategory] = useState('전체');
  const [uploadCategory, setUploadCategory] = useState('일반');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateSignedUrls, setTemplateSignedUrls] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserEmail(user.email);

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
    setDisplayName(profile?.full_name || '');
    const adminFlag = profile?.role === 'admin';
    setIsAdmin(adminFlag);
    if (!adminFlag) {
      setView(v => {
        if (v === 'checklist' || v === 'yearly') {
          const params = new URLSearchParams();
          params.set('view', 'lawsearch');
          isInternalNav.current = true;
          router.replace(`${pathname}?${params.toString()}`);
          return 'lawsearch';
        }
        return v;
      });
    }

    let { data: itemRows, error: itemErr } = await supabase
      .from('checklist_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (itemErr) { setError('항목을 불러오지 못했습니다: ' + itemErr.message); setLoading(false); return; }

    // 첫 로그인이면 기본 항목을 심어줌
    if (itemRows.length === 0) {
      const seed = DEFAULT_ITEMS.map(i => ({ ...i, user_id: user.id }));
      const { data: inserted, error: seedErr } = await supabase.from('checklist_items').insert(seed).select();
      if (!seedErr) itemRows = inserted;
    }

    const { data: logRows, error: logErr } = await supabase
      .from('checklist_log')
      .select('item_id, cycle_key, file_url, file_name');

    if (logErr) { setError('기록을 불러오지 못했습니다: ' + logErr.message); setLoading(false); return; }

    const map = {};
    const fmap = {};
    (logRows || []).forEach(r => {
      if (!map[r.item_id]) map[r.item_id] = new Set();
      map[r.item_id].add(r.cycle_key);
      if (r.file_url) {
        if (!fmap[r.item_id]) fmap[r.item_id] = {};
        fmap[r.item_id][r.cycle_key] = { path: r.file_url, name: r.file_name };
      }
    });

    setItems(itemRows || []);
    setDoneMap(map);
    setFileMap(fmap);

    const { data: templateRows } = await supabase
      .from('templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setTemplates(templateRows || []);

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleItem = async (item) => {
    const cycleKey = getCycleKey(item.period);
    const isDone = doneMap[item.id]?.has(cycleKey);
    const { data: { user } } = await supabase.auth.getUser();

    if (isDone) {
      await supabase.from('checklist_log').delete().eq('item_id', item.id).eq('cycle_key', cycleKey);
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id]);
        next[item.id].delete(cycleKey);
        return next;
      });
    } else {
      await supabase.from('checklist_log').insert({ item_id: item.id, cycle_key: cycleKey, user_id: user.id });
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id] || []);
        next[item.id].add(cycleKey);
        return next;
      });
    }
  };

  const uploadEvidence = async (item, file) => {
    if (!file) return;
    const cycleKey0 = getCycleKey(item.period);
    if (fileMap[item.id]?.[cycleKey0]) {
      if (!confirm('이미 첨부된 파일이 있어요. 새 파일로 교체할까요? (기존 파일은 사라져요)')) return;
    }
    setUploading(item.id);
    const cycleKey = getCycleKey(item.period);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${item.id}/${Date.now()}.${ext}`;

    // 네트워크 응답을 기다리지 않고, 방금 고른 파일을 브라우저에서 바로 미리보기로 보여줌
    const localPreviewUrl = URL.createObjectURL(file);
    setSignedUrls(prev => ({ ...prev, [path]: localPreviewUrl }));
    setFileMap(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), [cycleKey]: { path, name: file.name } },
    }));

    const rollback = (msg) => {
      setError(msg);
      setFileMap(prev => {
        const next = { ...prev };
        if (next[item.id]) { next[item.id] = { ...next[item.id] }; delete next[item.id][cycleKey]; }
        return next;
      });
      setUploading(null);
    };

    const { error: upErr } = await supabase.storage.from('evidence').upload(path, file);
    if (upErr) { rollback('파일 업로드 실패: ' + upErr.message); return; }

    const isDone = doneMap[item.id]?.has(cycleKey);
    if (isDone) {
      const { error: updErr, data: updData } = await supabase.from('checklist_log')
        .update({ file_url: path, file_name: file.name })
        .eq('item_id', item.id).eq('cycle_key', cycleKey)
        .select();
      if (updErr) { rollback('파일 정보 저장 실패: ' + updErr.message); return; }
      if (!updData || updData.length === 0) {
        rollback('파일 정보 저장 실패: 권한 문제로 기록이 갱신되지 않았어요. Supabase에서 checklist_log 수정 권한(UPDATE 정책)을 확인해주세요.');
        return;
      }
    } else {
      const { error: insErr } = await supabase.from('checklist_log')
        .insert({ item_id: item.id, cycle_key: cycleKey, user_id: user.id, file_url: path, file_name: file.name });
      if (insErr) { rollback('파일 정보 저장 실패: ' + insErr.message); return; }
      setDoneMap(prev => {
        const next = { ...prev };
        next[item.id] = new Set(next[item.id] || []);
        next[item.id].add(cycleKey);
        return next;
      });
    }

    setUploading(null);
  };

  const removeEvidence = async (item) => {
    const cycleKey = getCycleKey(item.period);
    const current = fileMap[item.id]?.[cycleKey];
    if (!current) return;
    await supabase.storage.from('evidence').remove([current.path]);
    await supabase.from('checklist_log')
      .update({ file_url: null, file_name: null })
      .eq('item_id', item.id).eq('cycle_key', cycleKey);
    setFileMap(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        next[item.id] = { ...next[item.id] };
        delete next[item.id][cycleKey];
      }
      return next;
    });
  };

  const getSignedUrl = async (path) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data, error: sErr } = await supabase.storage.from('evidence').createSignedUrl(path, 3600);
    if (sErr || !data) return null;
    setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const uploadTemplate = async (file) => {
    if (!file) return;
    setTemplateUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'dat';
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('templates').upload(path, file);
    if (upErr) { setError('양식 업로드 실패: ' + upErr.message); setTemplateUploading(false); return; }

    const maxOrder = templates.length > 0 ? Math.max(...templates.map(t => t.sort_order ?? 0)) + 1 : 0;
    const { data, error: insErr } = await supabase
      .from('templates')
      .insert({ user_id: user.id, name: file.name, file_url: path, file_name: file.name, sort_order: maxOrder, category: uploadCategory })
      .select();
    if (insErr) { setError('양식 정보 저장 실패: ' + insErr.message); setTemplateUploading(false); return; }

    setTemplates(prev => [...prev, ...(data || [])]);
    setTemplateUploading(false);
  };

  const deleteTemplate = async (tpl) => {
    if (!confirm(`"${tpl.file_name}" 양식을 삭제할까요?`)) return;
    await supabase.storage.from('templates').remove([tpl.file_url]);
    await supabase.from('templates').delete().eq('id', tpl.id);
    setTemplates(prev => prev.filter(t => t.id !== tpl.id));
  };

  const moveTemplate = async (tpl, direction, list) => {
    const group = [...(list || templates)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
    const idx = group.findIndex(t => t.id === tpl.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    const a = group[idx];
    const b = group[swapIdx];
    const tmpOrder = a.sort_order ?? 0;
    const newAOrder = b.sort_order ?? 0;
    const newBOrder = tmpOrder;

    setTemplates(prev => prev.map(p => {
      if (p.id === a.id) return { ...p, sort_order: newAOrder };
      if (p.id === b.id) return { ...p, sort_order: newBOrder };
      return p;
    }));

    await Promise.all([
      supabase.from('templates').update({ sort_order: newAOrder }).eq('id', a.id),
      supabase.from('templates').update({ sort_order: newBOrder }).eq('id', b.id),
    ]);
  };

  const getTemplateSignedUrl = async (path) => {
    if (templateSignedUrls[path]) return templateSignedUrls[path];
    const { data, error: sErr } = await supabase.storage.from('templates').createSignedUrl(path, 3600);
    if (sErr || !data) return null;
    setTemplateSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    return data.signedUrl;
  };

  const downloadTemplate = async (tpl) => {
    const url = await getTemplateSignedUrl(tpl.file_url);
    if (!url) { setError('파일을 여는 데 실패했어요.'); return; }
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = tpl.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError('다운로드 중 오류가 발생했어요: ' + e.message);
    }
  };

  const addItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    const sameperiod = items.filter(i => i.period === active);
    const nextOrder = sameperiod.length > 0
      ? Math.max(...sameperiod.map(i => i.sort_order ?? 0)) + 1
      : 0;
    const { data, error: insErr } = await supabase
      .from('checklist_items')
      .insert({ period: active, name: text, user_id: user.id, sort_order: nextOrder })
      .select();
    if (!insErr && data) {
      setItems(prev => [...prev, ...data]);
      setNewItemText('');
    }
  };

  const removeItem = async (id, name) => {
    if (!confirm(`"${name}" 항목을 삭제할까요? 완료 기록과 첨부파일도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await supabase.from('checklist_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditingItemText(item.name);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  const saveEditItem = async () => {
    const text = editingItemText.trim();
    if (!text) return;
    const { error: updErr } = await supabase
      .from('checklist_items')
      .update({ name: text })
      .eq('id', editingItemId);
    if (updErr) { alert('수정 실패: ' + updErr.message); return; }
    setItems(prev => prev.map(i => i.id === editingItemId ? { ...i, name: text } : i));
    setEditingItemId(null);
    setEditingItemText('');
  };

  const moveItem = async (item, direction) => {
    const group = items
      .filter(i => i.period === item.period)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(a.created_at) - new Date(b.created_at));
    const idx = group.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    // 그룹 전체 순서를 0,1,2... 로 정리한 뒤 두 항목만 맞바꿔요.
    const normalized = group.map((it, i) => ({ id: it.id, sort_order: i }));
    const tmp = normalized[idx].sort_order;
    normalized[idx].sort_order = normalized[swapIdx].sort_order;
    normalized[swapIdx].sort_order = tmp;

    setItems(prev => prev.map(p => {
      const found = normalized.find(n => n.id === p.id);
      return found ? { ...p, sort_order: found.sort_order } : p;
    }));

    await Promise.all(normalized.map(n =>
      supabase.from('checklist_items').update({ sort_order: n.sort_order }).eq('id', n.id)
    ));
  };

  const handleLogout = async () => {
    if (!confirm('정말 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navigate = (targetView, opts = {}) => {
    isInternalNav.current = true;
    setView(targetView);
    setOpenAnnouncementId(targetView === 'announcements' ? (opts.id || null) : null);
    const params = new URLSearchParams();
    params.set('view', targetView);
    if (opts.id) params.set('id', opts.id);
    const url = `${pathname}?${params.toString()}`;
    if (opts.replace) router.replace(url); else router.push(url);
  };

  const goToAdminOnlyView = async (targetView, opts = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      alert('관리자 권한이 해제되어 더 이상 접근할 수 없어요. 화면을 새로고침할게요.');
      window.location.reload();
      return;
    }
    navigate(targetView, opts);
  };

  const ADMIN_ONLY_VIEWS = ['checklist', 'yearly', 'adminUsers', 'evalCreate', 'evalReview'];
  const goTo = (targetView, payload) => {
    const opts = targetView === 'announcements' ? { id: payload } : {};
    if (ADMIN_ONLY_VIEWS.includes(targetView)) {
      goToAdminOnlyView(targetView, opts);
    } else {
      navigate(targetView, opts);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSettingsMsg(null);
    if (newPassword.length < 6) {
      setSettingsMsg({ type: 'error', text: '비밀번호는 6자 이상이어야 해요.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsMsg({ type: 'error', text: '비밀번호가 서로 일치하지 않아요.' });
      return;
    }
    setSettingsBusy(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    setSettingsBusy(false);
    if (pwErr) {
      setSettingsMsg({ type: 'error', text: '변경 실패: ' + pwErr.message });
      return;
    }
    setSettingsMsg({ type: 'success', text: '비밀번호가 변경되었어요.' });
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) return <div className="app-shell"><div className="main-content"><div className="content-inner"><div className="empty">불러오는 중...</div></div></div></div>;

  const periodItems = items
    .filter(i => i.period === active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(a.created_at) - new Date(b.created_at));
  const cycleKey = getCycleKey(active);
  const doneCount = periodItems.filter(i => doneMap[i.id]?.has(cycleKey)).length;
  const total = periodItems.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const thisYear = new Date().getFullYear();
  const yearsFromData = new Set([thisYear]);
  Object.values(doneMap).forEach(set => {
    set.forEach(k => { const y = parseInt(k.slice(0, 4), 10); if (!isNaN(y)) yearsFromData.add(y); });
  });
  const availableYears = Array.from(yearsFromData).sort((a, b) => b - a);

  return (
    <div className="app-shell">
      <div className="topbar-global">
        <div className="topbar-global-brand" style={{cursor:'pointer'}} onClick={() => navigate('home')}>
          <img
            src="/logo.gif"
            alt="회사 로고"
            style={{height:38, marginRight:4}}
            onError={e => {
              if (!e.currentTarget.dataset.retried) {
                e.currentTarget.dataset.retried = '1';
                e.currentTarget.src = '/logo.gif?retry=' + Date.now();
              } else {
                e.currentTarget.style.display = 'none';
              }
            }}
          />
          <span>안전보건</span>&nbsp;<span className="accent">통합관리시스템</span>
        </div>
        <div className="topbar-global-right">
          <span className="topbar-global-email">{displayName || userEmail}</span>
          <button
            className="topbar-global-logout"
            style={{padding:'7px 12px', fontSize:15}}
            onClick={() => { setShowSettings(true); setSettingsMsg(null); }}
            title="개인 설정"
          >
            ⚙️
          </button>
          <button className="topbar-global-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      {showSettings && (
        <div
          style={{
            position:'fixed', inset:0, background:'rgba(28,34,48,0.45)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="auth-card"
            style={{maxWidth:380, margin:0, boxShadow:'0 20px 50px rgba(0,0,0,0.3)'}}
            onClick={e => e.stopPropagation()}
          >
            <div className="auth-logo" style={{textAlign:'left'}}>개인 설정</div>
            <div className="auth-sub" style={{textAlign:'left'}}>{userEmail}</div>

            <form onSubmit={handleChangePassword}>
              <div className="auth-field">
                <label>새 비밀번호</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="auth-field">
                <label>새 비밀번호 확인</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
              </div>
              <button className="auth-submit" type="submit" disabled={settingsBusy}>
                {settingsBusy ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>

            {settingsMsg && <div className={"auth-msg " + settingsMsg.type}>{settingsMsg.text}</div>}

            <button
              onClick={() => setShowSettings(false)}
              style={{width:'100%', marginTop:14, padding:9, background:'none', border:'1px solid var(--line)', borderRadius:5, color:'var(--muted)', fontSize:13, fontWeight:600, cursor:'pointer'}}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="app-body">
      <aside className="sidebar">
        <nav>
          <div
            className={"sidebar-nav-item" + (view === 'home' ? " active" : "")}
            style={{justifyContent:'space-between'}}
            onClick={() => navigate('home')}
          >
            <span><span style={{marginRight:10}}>🏠</span>홈</span>
            {isAdmin && (
              <span
                onClick={e => { e.stopPropagation(); setHomeExpanded(v => !v); }}
                style={{fontSize:11, opacity:0.8, padding:'2px 4px'}}
              >
                {homeExpanded ? '▲' : '▼'}
              </span>
            )}
          </div>
          {isAdmin && homeExpanded && (
            <div
              className={"sidebar-nav-item" + (view === 'announcements' ? " active" : "")}
              style={{paddingLeft:34, fontSize:14}}
              onClick={() => goToAdminOnlyView('announcements')}
            >
              <span>📢</span> 공지사항
            </div>
          )}
          {isAdmin && (
            <>
              <div className={"sidebar-nav-item" + (view === 'checklist' ? " active" : "")} onClick={() => goToAdminOnlyView('checklist')}>
                <span>📋</span> 체크리스트
              </div>
              <div className={"sidebar-nav-item" + (view === 'yearly' ? " active" : "")} onClick={() => goToAdminOnlyView('yearly')}>
                <span>📅</span> 연도별 기록
              </div>
            </>
          )}
          <div className={"sidebar-nav-item" + (view === 'lawsearch' ? " active" : "")} onClick={() => navigate('lawsearch')}>
            <span>⚖️</span> 법령검색
          </div>
          <div className={"sidebar-nav-item" + (view === 'templates' ? " active" : "")} onClick={() => navigate('templates')}>
            <span>📁</span> 양식함
          </div>
          {isAdmin && (
            <>
              <div className={"sidebar-nav-item" + (view === 'evalCreate' ? " active" : "")} onClick={() => goToAdminOnlyView('evalCreate')}>
                <span>🏗️</span> 평가생성
              </div>
              <div className={"sidebar-nav-item" + (view === 'evalReview' ? " active" : "")} onClick={() => goToAdminOnlyView('evalReview')}>
                <span>📝</span> 평가검토
              </div>
            </>
          )}
        </nav>
        {isAdmin && (
          <div className="sidebar-footer-menu">
            <div className={"sidebar-nav-item" + (view === 'adminUsers' ? " active" : "")} onClick={() => goToAdminOnlyView('adminUsers')}>
              <span>🛡️</span> 회원 관리
            </div>
          </div>
        )}
      </aside>

      <main className="main-content">
        <div className="content-inner">
      <div className="masthead">
        <div>
          <h1>{VIEW_TITLES[view] || '안전보건 통합관리시스템'}</h1>
        </div>
      </div>
      <div className="stripe"></div>

      {error && <div className="disclaimer">{error}</div>}

      {view === 'home' && (
        <HomePanel displayName={displayName} userEmail={userEmail} isAdmin={isAdmin} goTo={goTo} />
      )}

      {view === 'announcements' && (
        <AnnouncementsPanel isAdmin={isAdmin} openAnnouncementId={openAnnouncementId} />
      )}

      {view === 'checklist' && isAdmin && (
        <>
          <div className="tabs">
            {PERIODS.map(p => {
              const pItems = items.filter(i => i.period === p.key);
              const ck = getCycleKey(p.key);
              const done = pItems.filter(i => doneMap[i.id]?.has(ck)).length;
              return (
                <div key={p.key} className={"tab" + (active === p.key ? " active" : "")} onClick={() => setActive(p.key)}>
                  {p.label}
                  <span className="count">{done}/{pItems.length}</span>
                </div>
              );
            })}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{PERIODS.find(p => p.key === active).label} 점검 항목</h2>
              <div className="cycle-label">{cycleLabel(active)} 기준</div>
            </div>
            <div className="progress-row">
              <div className="progress-bar"><div className="progress-fill" style={{ width: pct + '%' }}></div></div>
              <div className="progress-text">{doneCount}/{total} 완료</div>
            </div>

            {periodItems.length === 0 && <div className="empty">항목이 없습니다. 아래에서 추가해보세요.</div>}

            {periodItems.map((item, idx) => {
              const isDone = !!doneMap[item.id]?.has(cycleKey);
              const evidence = fileMap[item.id]?.[cycleKey];
              const isOpen = expandedItem === item.id;
              return (
                <div key={item.id}>
                  <div className="item">
                    <div className={"check" + (isDone ? " done" : "")} onClick={() => toggleItem(item)}></div>
                    {editingItemId === item.id ? (
                      <div className="item-body" style={{display:'flex', gap:8, alignItems:'center'}}>
                        <input
                          value={editingItemText}
                          onChange={e => setEditingItemText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditItem(); if (e.key === 'Escape') cancelEditItem(); }}
                          autoFocus
                          style={{flex:1, padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:14}}
                        />
                        <button className="add-btn" style={{fontSize:12, padding:'6px 12px'}} onClick={saveEditItem}>저장</button>
                        <button className="icon-btn" onClick={cancelEditItem}>취소</button>
                      </div>
                    ) : (
                      <div className="item-body" style={{cursor:'pointer'}} onClick={async () => {
                        if (isOpen) { setExpandedItem(null); return; }
                        setExpandedItem(item.id);
                        if (evidence) await getSignedUrl(evidence.path);
                      }}>
                        <div className={"item-name" + (isDone ? " done" : "")}>{item.name}</div>
                        <div className="item-meta">
                          {isDone ? <span className="badge ok">완료</span> : <span className="badge warn">미완료</span>}
                          {evidence && <span style={{marginLeft:6}}>📎 {evidence.name}</span>}
                        </div>
                      </div>
                    )}
                    <div className="item-actions">
                      <button className="icon-btn" onClick={() => moveItem(item, 'up')} disabled={idx === 0} title="위로" style={idx === 0 ? {opacity:0.3, cursor:'default'} : {}}>▲</button>
                      <button className="icon-btn" onClick={() => moveItem(item, 'down')} disabled={idx === periodItems.length - 1} title="아래로" style={idx === periodItems.length - 1 ? {opacity:0.3, cursor:'default'} : {}}>▼</button>
                      <button className="icon-btn" onClick={() => startEditItem(item)} title="수정">✏️</button>
                      <button className="icon-btn" onClick={() => removeItem(item.id, item.name)} title="삭제">✕</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{
                      background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                      padding:'14px 16px', margin:'2px 0 10px', fontSize:13, lineHeight:1.7,
                    }}>
                      {evidence ? (
                        <>
                          <div style={{marginBottom:8}}>
                            📎 <b>{evidence.name}</b>
                          </div>
                          {signedUrls[evidence.path] ? (
                            <>
                              {isImageFile(evidence.name) && (
                                <img
                                  src={signedUrls[evidence.path]}
                                  alt={evidence.name}
                                  style={{maxWidth:'100%', maxHeight:480, borderRadius:4, border:'1px solid var(--line)', display:'block', marginBottom:8}}
                                />
                              )}
                              {isPdfFile(evidence.name) && (
                                <iframe
                                  src={signedUrls[evidence.path]}
                                  title={evidence.name}
                                  style={{width:'100%', height:520, border:'1px solid var(--line)', borderRadius:4, marginBottom:8}}
                                />
                              )}
                              <a href={signedUrls[evidence.path]} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                                {isImageFile(evidence.name) || isPdfFile(evidence.name) ? '새 탭에서 크게 보기 ↗' : '파일 열어서 보기 ↗'}
                              </a>
                            </>
                          ) : (
                            <span style={{color:'var(--muted)'}}>미리보기 불러오는 중...</span>
                          )}
                          <div style={{marginTop:10, display:'flex', gap:10}}>
                            <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12}}>
                              {uploading === item.id ? '업로드 중...' : '파일 교체'}
                              <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
                                onChange={e => e.target.files[0] && uploadEvidence(item, e.target.files[0])} />
                            </label>
                            <button className="icon-btn" onClick={() => removeEvidence(item)}>첨부 삭제</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{marginBottom:8, color:'var(--muted)'}}>
                            이번 주기({cycleLabel(item.period)}) 완료 증빙자료가 아직 없어요.
                          </div>
                          <label className="add-btn" style={{cursor:'pointer', display:'inline-block', fontSize:12}}>
                            {uploading === item.id ? '업로드 중...' : 'PDF·사진 첨부하기'}
                            <input type="file" accept="application/pdf,image/*" style={{display:'none'}}
                              onChange={e => e.target.files[0] && uploadEvidence(item, e.target.files[0])} />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="add-row">
              <input
                placeholder={`${PERIODS.find(p => p.key === active).label} 항목 추가...`}
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              />
              <button className="add-btn" onClick={addItem}>추가</button>
            </div>
          </div>
        </>
      )}

      {view === 'yearly' && isAdmin && (
        <>
          <div className="tabs">
            {availableYears.map(y => (
              <div key={y} className={"tab" + (selectedYear === y ? " active" : "")} onClick={() => setSelectedYear(y)}>
                {y}년{y === thisYear ? ' (현재)' : ''}
              </div>
            ))}
          </div>

          <div className="tabs" style={{marginTop:8}}>
            {PERIODS.map(p => {
              const pItems = items.filter(i => i.period === p.key);
              if (pItems.length === 0) return null;
              return (
                <div key={p.key} className={"tab" + (yearlyPeriod === p.key ? " active" : "")} onClick={() => { setYearlyPeriod(p.key); setExpandedYearlyItem(null); }}>
                  {p.label}
                  <span className="count">{pItems.length}</span>
                </div>
              );
            })}
          </div>

          <div className="panel">
          {PERIODS.filter(p => p.key === yearlyPeriod).map((p, pIdx) => {
            const pItems = items.filter(i => i.period === p.key);
            if (pItems.length === 0) return (
              <div key={p.key} className="empty">이 주기에는 아직 항목이 없어요.</div>
            );
            return (
              <div key={p.key} style={{
                marginTop: pIdx === 0 ? 4 : 14,
                background:'var(--panel)', border:'1px solid var(--line)', borderRadius:6,
                padding:'16px 18px',
              }}>
                <div style={{
                  fontSize:16, fontWeight:800, margin:'0 0 10px', color:'var(--safety)',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{width:5, height:16, background:'var(--safety)', borderRadius:2, display:'inline-block'}}></span>
                  {p.label} 항목
                </div>
                {pItems.map(item => {
                  const done = !!doneMap[item.id]?.has(String(selectedYear));
                  const yearFiles = Object.entries(fileMap[item.id] || {})
                    .filter(([ck]) => ck === String(selectedYear))
                    .sort((a, b) => a[0].localeCompare(b[0]));
                  const isOpen = expandedYearlyItem === item.id;
                  return (
                    <div key={item.id}>
                      <div className="item" style={{cursor: yearFiles.length ? 'pointer' : 'default'}}
                        onClick={async () => {
                          if (!yearFiles.length) return;
                          if (isOpen) { setExpandedYearlyItem(null); return; }
                          setExpandedYearlyItem(item.id);
                          await Promise.all(yearFiles.map(([, f]) => getSignedUrl(f.path)));
                        }}>
                        <div className="item-body">
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            {done ? <span className="badge ok">완료</span> : <span className="badge warn">미완료</span>}
                            {' '}{selectedYear}년
                            {yearFiles.length > 0 && <span style={{marginLeft:6}}>📎 첨부 {yearFiles.length}건 {isOpen ? '▲' : '▼'}</span>}
                          </div>
                        </div>
                      </div>
                      {isOpen && yearFiles.length > 0 && (
                        <div style={{
                          background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                          padding:'12px 16px', margin:'2px 0 10px', fontSize:12.5, lineHeight:1.8,
                        }}>
                          {yearFiles.map(([ck, f]) => (
                            <div key={ck} style={{display:'flex', justifyContent:'space-between', gap:10}}>
                              <span>📎 {f.name} <span style={{color:'var(--muted)'}}>({ck})</span></span>
                              {signedUrls[f.path] ? (
                                <a href={signedUrls[f.path]} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)', flexShrink:0}}>
                                  보기 ↗
                                </a>
                              ) : (
                                <span style={{color:'var(--muted)'}}>불러오는 중...</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </>
      )}

      {view === 'lawsearch' && (() => {
        const lawNames = Object.keys(LAW_INDEX);
        const currentLaw = activeLawCategory && lawNames.includes(activeLawCategory) ? activeLawCategory : lawNames[0];
        const articles = LAW_INDEX[currentLaw];
        return (
          <>
            <div className="tabs">
              {lawNames.map(name => (
                <div key={name} className={"tab" + (currentLaw === name ? " active" : "")} onClick={() => setActiveLawCategory(name)}>
                  {name}
                  <span className="count">{LAW_INDEX[name].length}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>{currentLaw}</h2>
                <div className="cycle-label">조문을 클릭하면 바로 아래에 원문이 펼쳐져요</div>
              </div>
              {articles.map(a => {
                const key = `${currentLaw}|${a.no}`;
                const isOpen = expandedArticle === key;
                return (
                  <div key={a.no}>
                    <div
                      className="item"
                      style={{cursor:'pointer'}}
                      onClick={() => setExpandedArticle(isOpen ? null : key)}
                    >
                      <div className="item-body">
                        <div className="item-name">{a.no} ({a.title})</div>
                        {!a.text && <div className="item-meta">원문 준비 중 — 클릭 시 law.go.kr에서 확인</div>}
                        {a.text && <div className="item-meta">{isOpen ? '접기' : '펼쳐서 원문 보기'}</div>}
                      </div>
                      <div className="item-actions">
                        <span className="icon-btn">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{
                        background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                        padding:'14px 16px', margin:'2px 0 10px', fontSize:13, lineHeight:1.75,
                        whiteSpace:'pre-wrap', color:'#2a2f3a',
                      }}>
                        {a.text ? (
                          <>
                            {a.text}
                            <div style={{marginTop:12, fontSize:11.5, color:'var(--muted)'}}>
                              확인일: {a.lastChecked} · 개정 여부는{' '}
                              <a href={lawSearchUrl(currentLaw, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                                law.go.kr 최신 원문
                              </a>
                              에서 다시 확인하세요.
                            </div>
                          </>
                        ) : (
                          <>
                            아직 이 조문의 원문은 앱에 넣어두지 않았어요.{' '}
                            <a href={lawSearchUrl(currentLaw, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                              law.go.kr에서 바로 확인하기 ↗
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="footer-note" style={{marginTop:6}}>
                원문은 특정 시점 기준 스냅샷이에요. 법이 개정될 수 있으니 중요한 판단은 law.go.kr 최신본으로 다시 확인하세요.
              </div>
            </div>
          </>
        );
      })()}

      {view === 'templates' && (() => {
        const defaultCategories = ['일반', '현장서류', '중대재해처벌법'];
        const usedCategories = [...new Set(templates.map(t => t.category || '일반'))];
        const allCategories = [...new Set([...defaultCategories, ...usedCategories])];
        const sortedTemplates = [...templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
        const filteredTemplates = templateCategory === '전체'
          ? sortedTemplates
          : sortedTemplates.filter(t => (t.category || '일반') === templateCategory);

        return (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10}}>
            <div className="tabs" style={{margin:0}}>
              <div className={"tab" + (templateCategory === '전체' ? " active" : "")} onClick={() => setTemplateCategory('전체')}>
                전체<span className="count">{templates.length}</span>
              </div>
              {allCategories.map(cat => (
                <div key={cat} className={"tab" + (templateCategory === cat ? " active" : "")} onClick={() => setTemplateCategory(cat)}>
                  {cat}<span className="count">{templates.filter(t => (t.category || '일반') === cat).length}</span>
                </div>
              ))}
            </div>

            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              {showNewCategoryInput ? (
                <>
                  <input
                    placeholder="새 카테고리명"
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    style={{padding:'8px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13, width:120}}
                  />
                  <button className="icon-btn" onClick={() => {
                    if (newCategoryInput.trim()) { setUploadCategory(newCategoryInput.trim()); }
                    setShowNewCategoryInput(false); setNewCategoryInput('');
                  }}>확인</button>
                </>
              ) : (
                <select
                  value={uploadCategory}
                  onChange={e => {
                    if (e.target.value === '__new__') { setShowNewCategoryInput(true); }
                    else { setUploadCategory(e.target.value); }
                  }}
                  style={{padding:'9px 10px', border:'1px solid var(--line)', borderRadius:4, fontSize:13}}
                >
                  {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__new__">+ 새 카테고리...</option>
                </select>
              )}
              <label className="add-btn" style={{cursor:'pointer', display:'inline-block'}}>
                {templateUploading ? '업로드 중...' : `+ "${uploadCategory}"에 올리기`}
                <input type="file" style={{display:'none'}}
                  onChange={e => e.target.files[0] && uploadTemplate(e.target.files[0])} />
              </label>
            </div>
          </div>

          <div className="panel">
          {filteredTemplates.length === 0 && <div className="empty">이 카테고리에는 아직 올린 양식이 없어요.</div>}

          {filteredTemplates.map((tpl, idx) => (
            <div className="item" key={tpl.id}>
              <div className="item-body">
                <div className="item-name">📄 {tpl.file_name} <span className="badge" style={{marginLeft:6, background:'var(--safety-dim)', color:'var(--safety)'}}>{tpl.category || '일반'}</span></div>
                <div className="item-meta">{new Date(tpl.created_at).toLocaleDateString('ko-KR')} 업로드</div>
              </div>
              <div className="item-actions">
                <button className="icon-btn" onClick={() => moveTemplate(tpl, 'up', filteredTemplates)} disabled={idx === 0} title="위로" style={idx === 0 ? {opacity:0.3, cursor:'default'} : {}}>▲</button>
                <button className="icon-btn" onClick={() => moveTemplate(tpl, 'down', filteredTemplates)} disabled={idx === filteredTemplates.length - 1} title="아래로" style={idx === filteredTemplates.length - 1 ? {opacity:0.3, cursor:'default'} : {}}>▼</button>
                <button
                  className="icon-btn"
                  onClick={() => downloadTemplate(tpl)}
                  title="다운로드"
                  style={{fontSize:13, fontWeight:700, padding:'6px 12px', color:'var(--safety)'}}
                >
                  다운로드
                </button>
                <button className="icon-btn" onClick={() => deleteTemplate(tpl)} title="삭제">✕</button>
              </div>
            </div>
          ))}
          </div>
        </>
        );
      })()}

      {view === 'adminUsers' && isAdmin && <AdminUsersPanel />}
      {view === 'evalCreate' && isAdmin && <AdminEvalCreatePanel />}
      {view === 'evalReview' && isAdmin && <AdminEvalReviewPanel />}

        </div>
      </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="app-shell"><div className="main-content"><div className="content-inner"><div className="empty">불러오는 중...</div></div></div></div>}>
      <DashboardInner />
    </Suspense>
  );
}
