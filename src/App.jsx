import { useState, useEffect, useRef } from "react";
import { supabase } from './supabaseClient';

const ALL_PRODUCTS = [
  {id:"575",brand:"SHURE",name:"MV88+ Video Kit",priceIn:990,priceEx:900},
  {id:"572",brand:"AVALON DESIGN",name:"VT-747SP",priceIn:19800,priceEx:18000},
  {id:"574",brand:"TOMOCA",name:"F-26CN Black [26cm]",priceIn:440,priceEx:400},
  {id:"573",brand:"TOMOCA",name:"DS-3",priceIn:660,priceEx:600},
  {id:"459",brand:"Cooke",name:"SP3 32mm T2.4 [E/RFマウント]",priceIn:4400,priceEx:4000},
  {id:"460",brand:"Cooke",name:"SP3 50mm T2.4 [E/RFマウント]",priceIn:4400,priceEx:4000},
  {id:"461",brand:"Cooke",name:"SP3 75mm T2.4 [E/RFマウント]",priceIn:4400,priceEx:4000},
  {id:"462",brand:"Cooke",name:"SP3 100mm T2.4 [E/RFマウント]",priceIn:4400,priceEx:4000},
  {id:"458",brand:"Cooke",name:"SP3 25mm T2.4 [E/RFマウント]",priceIn:4400,priceEx:4000},
  {id:"571",brand:"GOPRO",name:"超広角レンズモッド [HERO13用]",priceIn:550,priceEx:500},
  {id:"570",brand:"Accsoon",name:"CineView SE [送信機x1,受信機x1]",priceIn:4950,priceEx:4500},
  {id:"569",brand:"JBL",name:"PAスピーカーセット [EON712x2+スタンドx2]",priceIn:7700,priceEx:7000},
  {id:"322",brand:"Electro-Voice",name:"PAスピーカーセット [ZLX-12Px2+スタンド×2]",priceIn:7700,priceEx:7000},
  {id:"568",brand:"Sony",name:"B帯ワイヤレスマイク デュアル [UTX-P40 x2+URX-P41D]",priceIn:5940,priceEx:5400},
  {id:"339",brand:"Sony",name:"UTX-P40 + URX-P40 [送受信セット]",priceIn:2970,priceEx:2700},
  {id:"466",brand:"GOPRO",name:"Maxレンズモッド2.0 [HERO12用]",priceIn:550,priceEx:500},
  {id:"122",brand:"Kenko",name:"ワイドバンド C-PL(W)フィルター [77mm]",priceIn:396,priceEx:360},
  {id:"567",brand:"CANARE",name:"XLRオス-RCAオス ペアケーブル 5m",priceIn:770,priceEx:700},
  {id:"559",brand:"GOPRO",name:"ライトモッド",priceIn:550,priceEx:500},
  {id:"72",brand:"GOPRO",name:"GOPRO Enduroバッテリー",priceIn:440,priceEx:400},
  {id:"560",brand:"GOPRO",name:"GOPRO13用 Enduroバッテリー",priceIn:440,priceEx:400},
  {id:"566",brand:"Velbon",name:"Coleman セルフィーマルチスタンド",priceIn:330,priceEx:300},
  {id:"564",brand:"DJI",name:"Osmo 360 アドベンチャーコンボ",priceIn:4950,priceEx:4500},
  {id:"565",brand:"TOMOCA",name:"TCC-60",priceIn:770,priceEx:700},
  {id:"562",brand:"Apple",name:"iPhone 17 Pro MAX 1TB",priceIn:5940,priceEx:5400},
  {id:"452",brand:"Apple",name:"iPhone 16 Pro Max 1TB",priceIn:4840,priceEx:4400},
  {id:"392",brand:"Apple",name:"iPhone 15 Pro MAX 1TB",priceIn:4840,priceEx:4400},
  {id:"17",brand:"Apple",name:"iPhone 14 Pro MAX 1TB",priceIn:3960,priceEx:3600},
  {id:"329",brand:"Sennheiser",name:"MKE600 セット",priceIn:1540,priceEx:1400},
  {id:"563",brand:"NANLITE",name:"PavoSlim 120C [RGBWW フルカラー]",priceIn:4950,priceEx:4500},
  {id:"561",brand:"No Brand",name:"XLRメス-RCAオス ペアケーブル 5m",priceIn:550,priceEx:500},
  {id:"126",brand:"Sony",name:"α7c [SDXCカード 64GB付属]",priceIn:4400,priceEx:4000},
  {id:"519",brand:"Manfrotto",name:"クロマキーブルー/グリーン [200cm x 180cm][リバーシブル]",priceIn:990,priceEx:900},
  {id:"520",brand:"Manfrotto",name:"クロマキーブルー [400cm x 290cm]",priceIn:4400,priceEx:4000},
  {id:"521",brand:"Manfrotto",name:"クロマキーグリーン [400cm x 230cm]",priceIn:3300,priceEx:3000},
  {id:"360",brand:"HOLLYLAND",name:"SOLIDCOM C1 Pro Hub8S",priceIn:14850,priceEx:13500},
  {id:"547",brand:"DJI",name:"OSMO ACTION エクストリームバッテリーPlus",priceIn:330,priceEx:300},
  {id:"558",brand:"NEP",name:"1.2GHz A型[RAMSA WX-DR131]用電源アダプター",priceIn:660,priceEx:600},
  {id:"344",brand:"AKG",name:"C414 XLⅡ STEREO MATCHED PAIR",priceIn:8800,priceEx:8000},
  {id:"279",brand:"SDS",name:"ML-3255 [32~55inch用ロースタンド]",priceIn:5500,priceEx:5000},
  {id:"557",brand:"Sony",name:"MDR-CD900ST",priceIn:770,priceEx:700},
  {id:"556",brand:"SHURE",name:"BETA 57A",priceIn:1540,priceEx:1400},
  {id:"264",brand:"Blackmagic Design",name:"Video Assist 7\" 12G HDR [7インチ]",priceIn:4840,priceEx:4400},
  {id:"265",brand:"Blackmagic Design",name:"Video Assist 5\" 12G HDR [5インチ]",priceIn:4290,priceEx:3900},
  {id:"555",brand:"DJI",name:"Osmo Pocket 3 バッテリーハンドル",priceIn:440,priceEx:400},
  {id:"554",brand:"SmallRig",name:"FX30 / FX3用ハンドヘルドケージキット",priceIn:990,priceEx:900},
  {id:"216",brand:"No Brand",name:"67mm→49mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"212",brand:"No Brand",name:"62mm→49mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"553",brand:"Sony",name:"AC-VQ1051D [Lバッテリー 2連チャージャー]",priceIn:550,priceEx:500},
  {id:"535",brand:"Manfrotto",name:"AUTOPOLE032B [210～370cm]",priceIn:1100,priceEx:1000},
  {id:"181",brand:"DJI",name:"ツイストグリップデュアルハンドル [RS4 RS3 RS2用]",priceIn:1100,priceEx:1000},
  {id:"77",brand:"Sony",name:"NP-FZ100 [FX2,FX3,α7sIII,ZV-E1,α7C用]",priceIn:495,priceEx:450},
  {id:"552",brand:"Insta360",name:"Insta360 X5用バッテリー [2,400mAh]",priceIn:550,priceEx:500},
  {id:"551",brand:"Insta360",name:"Ace Pro 2用バッテリー [1,800mAh]",priceIn:330,priceEx:300},
  {id:"550",brand:"Insta360",name:"Ace Pro 2",priceIn:3300,priceEx:3000},
  {id:"549",brand:"Insta360",name:"Insta360 X5 [見えない自撮り棒+三脚セット]",priceIn:4290,priceEx:3900},
  {id:"398",brand:"Insta360",name:"Insta360 X3 [見えない自撮り棒+三脚セット]",priceIn:3960,priceEx:3600},
  {id:"364",brand:"TOA",name:"ショルダーメガホン [ER-2130W]",priceIn:1980,priceEx:1800},
  {id:"359",brand:"TOMOCA",name:"F-3M [パラボックス 1in-3out]",priceIn:550,priceEx:500},
  {id:"345",brand:"AKG",name:"C414 XLⅡ",priceIn:4400,priceEx:4000},
  {id:"83",brand:"NEP",name:"FX2,FX3,α7sIII,ZV-E1用 FZ100タイプ ACアダプター",priceIn:550,priceEx:500},
  {id:"545",brand:"Sony",name:"FX2 [ILME-FX2B]",priceIn:3960,priceEx:3600},
  {id:"546",brand:"Sony",name:"XLR-H1 + ECM-XM1 セット",priceIn:1430,priceEx:1300},
  {id:"189",brand:"Kenko",name:"Variable NDXII Filter [82mm]",priceIn:1430,priceEx:1300},
  {id:"1",brand:"Sachtler",name:"FSB8T SLMCF[カーボン脚,ミッドスプレッダー]",priceIn:3850,priceEx:3500},
  {id:"349",brand:"SHURE",name:"SM63L [インタビューマイク]",priceIn:1100,priceEx:1000},
  {id:"544",brand:"BUFFALO",name:"USB-C→Cケーブル 2m",priceIn:330,priceEx:300},
  {id:"440",brand:"Sony",name:"SMAD-P5 [URX-P40,URX-P41D用][UWP-D21,D22に対応]",priceIn:440,priceEx:400},
  {id:"273",brand:"Roland",name:"VP-42H",priceIn:3740,priceEx:3400},
  {id:"230",brand:"SanDisk",name:"CFexpressTypeBカード 512GB",priceIn:1980,priceEx:1800},
  {id:"160",brand:"LAOWA",name:"100mm F2.8 2X Ultra Macro APO [EFマウント]",priceIn:3080,priceEx:2800},
  {id:"151",brand:"Voigtlander/COSINA",name:"NOKTON 50mm F1.2 Aspherical [Eマウント]",priceIn:3520,priceEx:3200},
  {id:"205",brand:"Kenko",name:"R-CROSS SCREEN [82mm]",priceIn:396,priceEx:360},
  {id:"106",brand:"Raynox",name:"MX-3000PRO [58mm セミフィッシュ]",priceIn:1980,priceEx:1800},
  {id:"103",brand:"ZUNOW",name:"TCX-15[72mm 1.5倍テレコン]",priceIn:1760,priceEx:1600},
  {id:"543",brand:"DJI",name:"OSMO ACTION 延長ロッド[1.5m]キット",priceIn:330,priceEx:300},
  {id:"542",brand:"Sony",name:"VMC-BNCM1 [FX3用タイムコードシンクケーブル]",priceIn:440,priceEx:400},
  {id:"500",brand:"TENTACLE",name:"TENTACLE SYNC E MKII",priceIn:1980,priceEx:1800},
  {id:"64",brand:"Sony",name:"HXR-MC1",priceIn:6600,priceEx:6000},
  {id:"48",brand:"Sony",name:"ZV-1[シューティンググリップ付]",priceIn:3960,priceEx:3600},
  {id:"34",brand:"Sony",name:"FX3 [CFexpress TypeA 80GB付属]",priceIn:11000,priceEx:10000},
  {id:"538",brand:"E-IMAGE",name:"軽量4尺イントレ [PST-20]",priceIn:2750,priceEx:2500},
  {id:"541",brand:"Libec",name:"DL-5RB",priceIn:990,priceEx:900},
  {id:"540",brand:"Libec",name:"JB40 KIT + SP-6B",priceIn:6600,priceEx:6000},
  {id:"539",brand:"Libec",name:"TR-320 [8m仕様]",priceIn:6600,priceEx:6000},
  {id:"537",brand:"E-IMAGE",name:"軽量3尺イントレ [PST-10]",priceIn:2200,priceEx:2000},
  {id:"536",brand:"Manfrotto",name:"AUTOPOLE076B [150～270cm]",priceIn:1100,priceEx:1000},
  {id:"534",brand:"Libec",name:"AS-7K",priceIn:1100,priceEx:1000},
  {id:"533",brand:"Manfrotto",name:"ナノクランプ [雲台付]",priceIn:550,priceEx:500},
  {id:"532",brand:"Manfrotto",name:"スーパークランプ[035]",priceIn:550,priceEx:500},
  {id:"531",brand:"Manfrotto",name:"バリアブルフリクションアーム [244]",priceIn:1100,priceEx:1000},
  {id:"530",brand:"Manfrotto",name:"MH494 [ボール雲台]",priceIn:550,priceEx:500},
  {id:"529",brand:"Bi Rod",name:"Bi スマホホルダー",priceIn:330,priceEx:300},
  {id:"528",brand:"No Brand",name:"スマホ/タブレットスタンド",priceIn:550,priceEx:500},
  {id:"473",brand:"No Brand",name:"ネックマウント",priceIn:550,priceEx:500},
  {id:"527",brand:"Bi Rod",name:"Y字型 腰当てベルト",priceIn:550,priceEx:500},
  {id:"526",brand:"Bi Rod",name:"Bi 無線式電動雲台 [デンウン]",priceIn:550,priceEx:500},
  {id:"525",brand:"edelkrone",name:"Wing [ボール雲台付]",priceIn:2200,priceEx:2000},
  {id:"524",brand:"edelkrone",name:"SLIDERPLUS PRO MEDIUM + STEADY MODULE",priceIn:4950,priceEx:4500},
  {id:"523",brand:"Libec",name:"ALX S12セット [120cm手動スライダー]",priceIn:3960,priceEx:3600},
  {id:"522",brand:"No Brand",name:"養生マット [180cm x 90cm]",priceIn:440,priceEx:400},
  {id:"518",brand:"DJI",name:"Osmo Mobile 7P Vlogコンボ",priceIn:1980,priceEx:1800},
  {id:"183",brand:"ZHIYUN",name:"CRANE M2 [耐荷重130g〜720g]",priceIn:2200,priceEx:2000},
  {id:"517",brand:"マキタ",name:"CW180DZ [電動クーラーボックス]",priceIn:5500,priceEx:5000},
  {id:"516",brand:"No Brand",name:"電源延長コード 3口 10m [15A]",priceIn:440,priceEx:400},
  {id:"515",brand:"No Brand",name:"電源延長コード 3口 20m [15A]",priceIn:550,priceEx:500},
  {id:"514",brand:"ハタヤ",name:"電源ドラム 30m",priceIn:550,priceEx:500},
  {id:"372",brand:"ANKER",name:"PowerHouse [434Wh / 120,600mAh]",priceIn:2420,priceEx:2200},
  {id:"371",brand:"LACITA",name:"水に強いポータブル電源 [ENERBOX-SP][444Wh]",priceIn:2860,priceEx:2600},
  {id:"369",brand:"CLASSIC PRO",name:"UPS1000RT [無停電電源]",priceIn:5500,priceEx:5000},
  {id:"444",brand:"BELDEN",name:"XLRケーブル [BELDEN 1192A] 10m",priceIn:550,priceEx:500},
  {id:"445",brand:"BELDEN",name:"XLRケーブル [BELDEN 1192A] 20m",priceIn:880,priceEx:800},
  {id:"446",brand:"BELDEN",name:"XLRケーブル [BELDEN 1192A] 30m",priceIn:880,priceEx:800},
  {id:"447",brand:"BELDEN",name:"XLRケーブル [BELDEN 1192A] 50m",priceIn:1100,priceEx:1000},
  {id:"368",brand:"BELDEN",name:"XLRケーブル [BELDEN 1192A] 5m",priceIn:550,priceEx:500},
  {id:"367",brand:"TOMOCA",name:"卓上マイクスタンド [高さ23cm~35cm]",priceIn:1100,priceEx:1000},
  {id:"366",brand:"K&M",name:"ショートマイクスタンド [高さ42.5cm~64.5cm]",priceIn:1100,priceEx:1000},
  {id:"365",brand:"K&M",name:"マイクスタンド [高さ 90cm~1.6m / ブーム長 80cm]",priceIn:1100,priceEx:1000},
  {id:"363",brand:"APPLAUSE SYSTEMS",name:"キャッチミー 5波セット",priceIn:5390,priceEx:4900},
  {id:"362",brand:"Motorola",name:"GDR4800 [ハイパワー無線機]",priceIn:2200,priceEx:2000},
  {id:"361",brand:"HOLLYLAND",name:"SOLIDCOM C1 6chセット",priceIn:6600,priceEx:6000},
  {id:"357",brand:"SHURE",name:"WH20XLR",priceIn:1100,priceEx:1000},
  {id:"355",brand:"vdB",name:"M [60cm~266cm / 410g]",priceIn:1100,priceEx:1000},
  {id:"354",brand:"K-Tek",name:"K-202 [117cm~513cm / 759g]",priceIn:1650,priceEx:1500},
  {id:"353",brand:"SHURE",name:"55SH Ⅱ [ガイコツマイク]",priceIn:1650,priceEx:1500},
  {id:"352",brand:"SHURE",name:"SM57",priceIn:1100,priceEx:1000},
  {id:"351",brand:"SHURE",name:"SM58 [スイッチなし]",priceIn:1100,priceEx:1000},
  {id:"350",brand:"SHURE",name:"SM58S [スイッチ付き]",priceIn:1100,priceEx:1000},
  {id:"348",brand:"Sennheiser",name:"MD421-Ⅱ",priceIn:3850,priceEx:3500},
  {id:"347",brand:"CROWN [AMCRON]",name:"PCC-160",priceIn:1100,priceEx:1000},
  {id:"346",brand:"AKG",name:"C451B",priceIn:2200,priceEx:2000},
  {id:"513",brand:"SHURE",name:"SM7B + Boom Arm セット",priceIn:4840,priceEx:4400},
  {id:"343",brand:"NEUMANN",name:"U87Ai + EA87 セット",priceIn:5500,priceEx:5000},
  {id:"342",brand:"No Brand",name:"ピンマイク用ウィンドスクリーン",priceIn:330,priceEx:300},
  {id:"341",brand:"Sony",name:"ECM-77B",priceIn:1100,priceEx:1000},
  {id:"340",brand:"TASCAM",name:"DR-10L",priceIn:1100,priceEx:1000},
  {id:"442",brand:"ZOOM",name:"F2-BT",priceIn:1320,priceEx:1200},
  {id:"443",brand:"TASCAM",name:"DR-10L Pro + AK-BT1",priceIn:1320,priceEx:1200},
  {id:"495",brand:"DJI",name:"OSMO ACTION5 PRO",priceIn:2750,priceEx:2500},
  {id:"512",brand:"DJI",name:"DJI ラベリアマイク [DJI MIC2,DJI MIC対応]",priceIn:990,priceEx:900},
  {id:"334",brand:"DJI",name:"DJI MIC",priceIn:1540,priceEx:1400},
  {id:"511",brand:"DJI",name:"DJI MIC 2",priceIn:1760,priceEx:1600},
  {id:"441",brand:"No Brand",name:"ピンマイク送信機収納ベルト",priceIn:550,priceEx:500},
  {id:"337",brand:"Sony",name:"B帯ワイヤレスマイク シングル[UWP-D11セット]",priceIn:1980,priceEx:1800},
  {id:"336",brand:"Sony",name:"B帯ワイヤレスハンドマイク [UWP-D22セット]",priceIn:2200,priceEx:2000},
  {id:"335",brand:"Sony",name:"B帯ワイヤレスマイク シングル[UWP-D21セット]",priceIn:2200,priceEx:2000},
  {id:"439",brand:"Sony",name:"B帯ワイヤレスマイク デュアル [UTX-B40 x2+URX-P41D]",priceIn:4400,priceEx:4000},
  {id:"333",brand:"RAMSA [Panasonic]",name:"B帯ワイヤレスマイク シングル [WX-RJ700A+WX-TB841]",priceIn:6600,priceEx:6000},
  {id:"332",brand:"RAMSA [Panasonic]",name:"1.2GHz A型デジタルワイヤレスマイク デュアル [WX-DT130×2,WX-DR131×1]",priceIn:12650,priceEx:11500},
  {id:"330",brand:"audio-technica",name:"AT8541 [ファンタムパワーサプライ]",priceIn:1650,priceEx:1500},
  {id:"510",brand:"Sennheiser",name:"MKH-416 12T[ソフタイ]",priceIn:4730,priceEx:4300},
  {id:"328",brand:"Sennheiser",name:"MKH-416 P48[ソフタイ]",priceIn:4180,priceEx:3800},
  {id:"327",brand:"OLYMPUS",name:"DM-750 & TP8 [電話録音セット]",priceIn:880,priceEx:800},
  {id:"326",brand:"TASCAM",name:"DR-40 VER2-J",priceIn:1650,priceEx:1500},
  {id:"325",brand:"Roland",name:"VT-4 [VOICE TRANSFORMER]",priceIn:2200,priceEx:2000},
  {id:"324",brand:"dbx",name:"iEQ-31 [2ch, 31バンド]",priceIn:6930,priceEx:6300},
  {id:"323",brand:"YAMAHA",name:"MS101 III",priceIn:1100,priceEx:1000},
  {id:"321",brand:"Sigma",name:"KS-342 [入力メス 出力オス]",priceIn:4400,priceEx:4000},
  {id:"320",brand:"Behringer",name:"X1222USB XENYX",priceIn:3300,priceEx:3000},
  {id:"319",brand:"Solid State Logic",name:"SSL SiX",priceIn:9900,priceEx:9000},
  {id:"318",brand:"ZOOM",name:"LiveTrak L-12 [Digital mixer + Recoder]",priceIn:2200,priceEx:2000},
  {id:"455",brand:"GOPRO",name:"GOPRO MAX",priceIn:3960,priceEx:3600},
  {id:"427",brand:"Aputure",name:"Amaran T4c [LED RGB チューブライト]",priceIn:2970,priceEx:2700},
  {id:"287",brand:"Manfrotto",name:"681B",priceIn:660,priceEx:600},
  {id:"286",brand:"Manfrotto",name:"MVM500A",priceIn:990,priceEx:900},
  {id:"282",brand:"Libec",name:"TH-Z",priceIn:990,priceEx:900},
  {id:"281",brand:"Sachtler",name:"Ace L GS CF [カーボン脚, グランドスプレッダー]",priceIn:1155,priceEx:1050},
  {id:"280",brand:"Sachtler",name:"Ace L MS CF [カーボン脚, ミッドスプレッダー]",priceIn:1155,priceEx:1050},
  {id:"60",brand:"GOPRO",name:"GOPRO HERO8 BLACK",priceIn:2420,priceEx:2200},
  {id:"59",brand:"GOPRO",name:"GOPRO HERO9 BLACK",priceIn:2750,priceEx:2500},
  {id:"51",brand:"DJI",name:"DJI Action2 Dual-Screen Combo",priceIn:3960,priceEx:3600},
  {id:"49",brand:"DJI",name:"DJI Pocket2 Creator Combo",priceIn:2970,priceEx:2700},
  {id:"43",brand:"Sony",name:"FDR-AX60",priceIn:2970,priceEx:2700},
  {id:"38",brand:"Sony",name:"HXR-NX5R [ワイドコンバージョンレンズ付属]",priceIn:7700,priceEx:7000},
  {id:"32",brand:"Sony",name:"PXW-X70 [ワイドコンバージョンレンズ付属]",priceIn:5500,priceEx:5000},
  {id:"31",brand:"Sony",name:"PXW-Z90 [ワイドコンバージョンレンズ付属]",priceIn:5500,priceEx:5000},
  {id:"23",brand:"Apple",name:"iPad 128GB [第7世代]",priceIn:1650,priceEx:1500},
  {id:"21",brand:"Apple",name:"Apple Pencil [第2世代]",priceIn:770,priceEx:700},
  {id:"20",brand:"Apple",name:"iPad Pro 12.9inch [第6世代] 256GB",priceIn:2640,priceEx:2400},
  {id:"19",brand:"Apple",name:"iPhone 12 Pro MAX 512GB",priceIn:3520,priceEx:3200},
  {id:"18",brand:"Apple",name:"iPhone 13 Pro MAX 1TB",priceIn:3960,priceEx:3600},
  {id:"88",brand:"GOPRO",name:"GOPRO Karma Grip",priceIn:2200,priceEx:2000},
  {id:"89",brand:"GOPRO",name:"VOLTA [スイッチ付き バッテリーグリップ]",priceIn:550,priceEx:500},
  {id:"35",brand:"Blackmagic Design",name:"Blackmagic Pocket Cinema Camera 6K Pro + Wise SSD 2TBセット",priceIn:9900,priceEx:9000},
  {id:"36",brand:"Blackmagic Design",name:"Blackmagic Pocket Cinema Camera 6K + Wise SSD 2TBセット",priceIn:8800,priceEx:8000},
  {id:"132",brand:"Canon",name:"EOS 5D Mark Ⅳ",priceIn:9900,priceEx:9000},
  {id:"133",brand:"Canon",name:"EOS 5D Mark Ⅲ",priceIn:9900,priceEx:9000},
  {id:"490",brand:"DJI",name:"RS 4 Pro Combo",priceIn:7700,priceEx:7000},
  {id:"175",brand:"DJI",name:"RS 3 Pro Combo",priceIn:7700,priceEx:7000},
  {id:"187",brand:"Canon",name:"430EX II",priceIn:1650,priceEx:1500},
  {id:"188",brand:"Canon",name:"ST-E2",priceIn:1100,priceEx:1000},
  {id:"502",brand:"DJI",name:"DJI SDR Transmission コンボ",priceIn:3960,priceEx:3600},
  {id:"262",brand:"HOLLYLAND",name:"COSMO C1 [屋内専用 最大300m HDMI&SDI]",priceIn:5390,priceEx:4900},
  {id:"496",brand:"TASCAM[olq]",name:"DR-10C [RAMSA仕様]",priceIn:2970,priceEx:2700},
  {id:"509",brand:"ZOOM",name:"F3 [2ch入力収録]",priceIn:1650,priceEx:1500},
  {id:"317",brand:"ZOOM",name:"FRC-8 [F8n用コントローラー]",priceIn:1320,priceEx:1200},
  {id:"316",brand:"ZOOM",name:"F8n [8ch入力, 最大10トラック同時収録]",priceIn:3850,priceEx:3500},
  {id:"438",brand:"ZOOM",name:"F8n Pro [8ch入力,最大10トラック同時収録]",priceIn:3850,priceEx:3500},
  {id:"437",brand:"No Brand",name:"ウェイト 10kg",priceIn:550,priceEx:500},
  {id:"314",brand:"Manfrotto",name:"テレスコピックポール 272B",priceIn:990,priceEx:900},
  {id:"508",brand:"Sony",name:"HVL-LEIR1 [赤外線ライト]",priceIn:550,priceEx:500},
  {id:"313",brand:"Manfrotto",name:"アルミスタンド 1052BAC [101cm〜237cm]",priceIn:990,priceEx:900},
  {id:"435",brand:"AVENGER",name:"センチュリースタンド[134cm〜328cm]",priceIn:1100,priceEx:1000},
  {id:"434",brand:"suntech",name:"まるれふ 85cm [MG85]",priceIn:990,priceEx:900},
  {id:"433",brand:"写真電気工業",name:"リファライト 40x40 [ハロゲンランプ 200W]",priceIn:2200,priceEx:2000},
  {id:"431",brand:"Aputure",name:"AL-F7 [NP-F970, USB,D-TAP][Bi-color 3200K-9500K]",priceIn:990,priceEx:900},
  {id:"430",brand:"Aputure",name:"AL-MC [USB][RGB COLOR]",priceIn:990,priceEx:900},
  {id:"429",brand:"Aputure",name:"Amaran COB 60X S + ハンドヘルドブラケットセット",priceIn:2200,priceEx:2000},
  {id:"428",brand:"Aputure",name:"Amaran T2c [LED RGBチューブライト]",priceIn:1980,priceEx:1800},
  {id:"304",brand:"No Brand",name:"小型赤外線ライト[IRライト / 広範囲型]",priceIn:2970,priceEx:2700},
  {id:"302",brand:"NEP",name:"LED-L500REF-DIGI-VCT-V [V-mount + AC][Bi-color 3200k-5600k]",priceIn:2970,priceEx:2700},
  {id:"301",brand:"Fiilex",name:"P360S 3灯セット [AC / Bi-color 2800k-6500k]",priceIn:4950,priceEx:4500},
  {id:"423",brand:"Aputure",name:"SPOTLIGHT MINI ZOOM [LS60x & 60d専用]",priceIn:2750,priceEx:2500},
  {id:"422",brand:"Aputure",name:"LANTERN",priceIn:1100,priceEx:1000},
  {id:"421",brand:"Aputure",name:"LANTERN 90",priceIn:1100,priceEx:1000},
  {id:"420",brand:"Aputure",name:"LIGHT DOME MINI II",priceIn:1320,priceEx:1200},
  {id:"419",brand:"Aputure",name:"LIGHT DOME II",priceIn:2200,priceEx:2000},
  {id:"418",brand:"Aputure",name:"F10 バンドア [LS600x,F10 フレネルに最適]",priceIn:1100,priceEx:1000},
  {id:"417",brand:"Aputure",name:"F10 フレネル [LS600xに最適]",priceIn:2200,priceEx:2000},
  {id:"295",brand:"Aputure",name:"LS 60x [V-mount + AC][Bi-color 2700k-6500k]",priceIn:2750,priceEx:2500},
  {id:"294",brand:"Aputure",name:"LS C120D Ⅱ [V-mount + AC][5500k]",priceIn:3960,priceEx:3600},
  {id:"414",brand:"Aputure",name:"LS C300D II [V-mount + AC][5500k]",priceIn:4950,priceEx:4500},
  {id:"413",brand:"Aputure",name:"LS 600x Pro [V-mount + AC][Bi-color 2700k-6500k]",priceIn:8910,priceEx:8100},
  {id:"507",brand:"Aputure",name:"amaran 300c [AC][RGBフルカラー]",priceIn:1980,priceEx:1800},
  {id:"412",brand:"No Brand",name:"スマホホルダー",priceIn:330,priceEx:300},
  {id:"290",brand:"Manfrotto",name:"卓上三脚 PIXI",priceIn:330,priceEx:300},
  {id:"289",brand:"Manfrotto",name:"卓上三脚 PIXI EVO",priceIn:550,priceEx:500},
  {id:"288",brand:"JOBY",name:"ゴリラポッド 5K [JB01509-BWW]",priceIn:550,priceEx:500},
  {id:"406",brand:"Bi Rod",name:"Bi Rod 6C-4500 + 専用三脚セット [1.0m〜4.5m 2.0kg]",priceIn:2200,priceEx:2000},
  {id:"405",brand:"Bi Rod",name:"Bi Rod 6C-7500 + 専用三脚セット [1.55m〜7.5m 3.2kg]",priceIn:2420,priceEx:2200},
  {id:"283",brand:"Velbon",name:"EX-647 VIDEO",priceIn:990,priceEx:900},
  {id:"506",brand:"Blackmagic Design",name:"Mini Converter UpDownCross HD",priceIn:1100,priceEx:1000},
  {id:"278",brand:"Blackmagic Design",name:"Micro Converter HDMI to SDI 12G",priceIn:1100,priceEx:1000},
  {id:"277",brand:"Roland",name:"VC-1-SC",priceIn:3300,priceEx:3000},
  {id:"276",brand:"Roland",name:"VC-1-DL",priceIn:3300,priceEx:3000},
  {id:"272",brand:"Roland",name:"V-1HD",priceIn:3300,priceEx:3000},
  {id:"275",brand:"Blackmagic Design",name:"MultiView 4 HD [SDI4分割機]",priceIn:1100,priceEx:1000},
  {id:"505",brand:"Decimator Design",name:"DMON-16S [SDI入力 1〜16分割]",priceIn:7700,priceEx:7000},
  {id:"271",brand:"Roland",name:"XS-1HD",priceIn:11000,priceEx:10000},
  {id:"270",brand:"Roland",name:"V-60HD",priceIn:11000,priceEx:10000},
  {id:"269",brand:"Sony",name:"PDW-U4",priceIn:8800,priceEx:8000},
  {id:"504",brand:"MSI",name:"PRO MP273U [27inchモニター]",priceIn:2970,priceEx:2700},
  {id:"503",brand:"I-O DATA",name:"EX-U431D [43inchモニター]",priceIn:13200,priceEx:12000},
  {id:"268",brand:"SmallRig",name:"Video Assist 5\" 12G HDR用ケージ+サンフードセット",priceIn:550,priceEx:500},
  {id:"267",brand:"SmallRig",name:"Video Assist 7\" 12G HDR用ケージ+サンフードセット",priceIn:550,priceEx:500},
  {id:"453",brand:"Sony",name:"PXW-Z200",priceIn:8800,priceEx:8000},
  {id:"454",brand:"GOPRO",name:"GOPRO HERO13 BLACK",priceIn:3300,priceEx:3000},
  {id:"456",brand:"No Brand",name:"USB-C [マイクin][ヘッドフォンout] 変換アダプター",priceIn:550,priceEx:500},
  {id:"457",brand:"YAMAHA",name:"MG16XU",priceIn:5500,priceEx:5000},
  {id:"451",brand:"Apple",name:"USB-C Digital AV Multiport アダプター",priceIn:550,priceEx:500},
  {id:"450",brand:"olq",name:"iPhone 15 Pro MAX 1TB クリエイターセット",priceIn:9460,priceEx:8600},
  {id:"400",brand:"NEP",name:"4K POVCAM AG-UMR20用 自由雲台ブラケット",priceIn:990,priceEx:900},
  {id:"399",brand:"GOPRO",name:"GOPRO HERO12 BLACK",priceIn:3300,priceEx:3000},
  {id:"397",brand:"DJI",name:"DJI OSMO Pocket3 Creator Combo",priceIn:3498,priceEx:3180},
  {id:"396",brand:"Roland",name:"UVC-01 [USBビデオキャプチャー]",priceIn:1540,priceEx:1400},
  {id:"395",brand:"Blackmagic Design",name:"UltraStudio Recorder 3G [Thunderbolt3 ビデオキャプチャー]",priceIn:1650,priceEx:1500},
  {id:"377",brand:"Voigtlander/COSINA",name:"NOKTON 50mm F1 Aspherical [Eマウント]",priceIn:3520,priceEx:3200},
  {id:"394",brand:"olq",name:"5G対応 世界[117ヵ国]モバイルWiFi [日本4キャリア自動切替]",priceIn:1650,priceEx:1500},
  {id:"228",brand:"No Brand",name:"52mm→37mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"227",brand:"No Brand",name:"49mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"226",brand:"No Brand",name:"52mm→49mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"225",brand:"No Brand",name:"43mm→52mmステップアップリング",priceIn:110,priceEx:100},
  {id:"224",brand:"No Brand",name:"58mm→62mmステップアップリング",priceIn:110,priceEx:100},
  {id:"223",brand:"No Brand",name:"62mm→52mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"222",brand:"No Brand",name:"72mm→67mmステップダウンリング",priceIn:110,priceEx:100},
  {id:"221",brand:"No Brand",name:"67mm→72mmステップアップリング",priceIn:110,priceEx:100},
  {id:"219",brand:"No Brand",name:"58mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"218",brand:"No Brand",name:"58mm→72mmステップアップリング",priceIn:110,priceEx:100},
  {id:"215",brand:"No Brand",name:"49mm→52mmステップアップリング",priceIn:110,priceEx:100},
  {id:"214",brand:"No Brand",name:"77mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"213",brand:"No Brand",name:"95mm→105mmステップアップリング",priceIn:110,priceEx:100},
  {id:"211",brand:"No Brand",name:"55mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"210",brand:"No Brand",name:"52mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"209",brand:"No Brand",name:"62mm→72mmステップアップリング",priceIn:110,priceEx:100},
  {id:"208",brand:"No Brand",name:"67mm→77mmステップアップリング",priceIn:110,priceEx:100},
  {id:"207",brand:"No Brand",name:"67mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"206",brand:"No Brand",name:"72mm→82mmステップアップリング",priceIn:110,priceEx:100},
  {id:"154",brand:"Sony",name:"Vario-Tessar T FE24-70mm F4 ZA OSS [SEL2470Z]",priceIn:2200,priceEx:2000},
  {id:"148",brand:"Voigtlander/COSINA",name:"NOKTON 35mm F1.2 Aspherical SE [Eマウント]",priceIn:3080,priceEx:2800},
  {id:"146",brand:"Sony",name:"FE24mm F1.4 GM [SEL24F14GM]",priceIn:3080,priceEx:2800},
  {id:"145",brand:"Sony",name:"FE14mm F1.8 GM [SEL14F18GM]",priceIn:2800,priceEx:2545},
  {id:"144",brand:"Sony",name:"2X テレコンバーター [SEL20TC]",priceIn:1650,priceEx:1500},
  {id:"143",brand:"Sony",name:"FE200-600mm F5.6-6.3 G OSS [SEL200600G]",priceIn:3080,priceEx:2800},
  {id:"142",brand:"Sony",name:"FE100-400mm F4.5-5.6 GM OSS [SEL100400GM]",priceIn:3520,priceEx:3200},
  {id:"141",brand:"Sony",name:"FE70-200mm F2.8 GM OSS [SEL70200GM]",priceIn:3520,priceEx:3200},
  {id:"140",brand:"Sony",name:"FE70-200mm F2.8 GM OSS II [SEL70200GM2]",priceIn:3520,priceEx:3200},
  {id:"139",brand:"Sony",name:"FE PZ 28-135mm F4 G OSS [SELP28135G]",priceIn:3080,priceEx:2800},
  {id:"138",brand:"Sony",name:"FE24-105mm F4 G OSS [SEL24105G]",priceIn:3080,priceEx:2800},
  {id:"137",brand:"Sony",name:"FE24-70mm F2.8 GM II [SEL2470GM2]",priceIn:3080,priceEx:2800},
  {id:"136",brand:"Sony",name:"FE24-70mm F2.8 GM [SEL2470GM]",priceIn:3080,priceEx:2800},
  {id:"135",brand:"Sony",name:"FE16-35mm F2.8 GM [SEL1635GM]",priceIn:3080,priceEx:2800},
  {id:"134",brand:"Sony",name:"FE12-24mm F2.8 GM [SEL1224GM]",priceIn:3520,priceEx:3200},
  {id:"131",brand:"Sony",name:"DSC-RX100M5A [SDXCカード64GB付属]",priceIn:3850,priceEx:3500},
  {id:"130",brand:"Sony",name:"α7sⅡ [SDXCカード 64GB付属]",priceIn:16500,priceEx:15000},
  {id:"127",brand:"Panasonic",name:"LUMIX DC-GH6 [CFexpress TypeB 512GB付属]",priceIn:6380,priceEx:5800},
  {id:"124",brand:"Sony",name:"α7sⅢ [CFexpress TypeA 80GB付属]",priceIn:9900,priceEx:9000},
  {id:"121",brand:"No Brand",name:"HDMIケーブル 100m [4K対応 光ファイバー]",priceIn:1980,priceEx:1800},
  {id:"118",brand:"No Brand",name:"HDMIケーブル 20m [4K対応 光ファイバー]",priceIn:770,priceEx:700},
  {id:"117",brand:"No Brand",name:"HDMIケーブル 10m [4K対応 光ファイバー]",priceIn:550,priceEx:500},
  {id:"119",brand:"No Brand",name:"HDMIケーブル 30m [4K対応 光ファイバー]",priceIn:990,priceEx:900},
  {id:"111",brand:"Technical Farm",name:"TF-WX0.3[HXR-MC1用超広角レンズ]",priceIn:1100,priceEx:1000},
  {id:"101",brand:"Sony",name:"RM-1BP",priceIn:550,priceEx:500},
  {id:"90",brand:"Feiyu Tech",name:"アクションカム用 ジンバル G5GS",priceIn:3300,priceEx:3000},
  {id:"84",brand:"No Brand",name:"クリップ式雲台",priceIn:550,priceEx:500},
  {id:"82",brand:"NEP",name:"FX6用Vマウントアダプター",priceIn:1100,priceEx:1000},
  {id:"81",brand:"NEP",name:"4K POVCAM AG-UMR20用 Vマウントプレート",priceIn:990,priceEx:900},
  {id:"78",brand:"Panasonic",name:"DMW-BLK22 [GH6用]",priceIn:495,priceEx:450},
  {id:"76",brand:"Blackmagic Design",name:"NP-F570 Battery [PCC6KPro用]",priceIn:495,priceEx:450},
  {id:"75",brand:"Sony",name:"NP-BX1 [X3000R,ZV-1,ZV-1II用]",priceIn:396,priceEx:360},
  {id:"74",brand:"Panasonic",name:"AG-VBR118G [4K POVCAM用]",priceIn:550,priceEx:500},
  {id:"73",brand:"Panasonic",name:"VW-VBG260[POVCAM用バッテリー]",priceIn:495,priceEx:450},
  {id:"70",brand:"GOPRO",name:"GOPRO6/7/8用バッテリー",priceIn:495,priceEx:450},
  {id:"69",brand:"Sony",name:"NP-FV100",priceIn:495,priceEx:450},
  {id:"68",brand:"Sony",name:"NP-F970",priceIn:495,priceEx:450},
  {id:"67",brand:"ANKER",name:"PowerCore Fusion 10000 [9700mAh]",priceIn:330,priceEx:300},
  {id:"66",brand:"IDX",name:"DUO-C198/P",priceIn:1320,priceEx:1200},
  {id:"65",brand:"JVC",name:"GZ-RY980[4K/5m防水 1時間以内]",priceIn:3850,priceEx:3500},
  {id:"63",brand:"Panasonic",name:"POVCAM[ワイドコンバージョンレンズ,20mケーブル]",priceIn:7700,priceEx:7000},
  {id:"62",brand:"Panasonic",name:"4K POVCAM[ワイドコンバージョンレンズ,20mケーブル]",priceIn:7700,priceEx:7000},
  {id:"58",brand:"GOPRO",name:"GOPRO HERO10 BLACK",priceIn:2750,priceEx:2500},
  {id:"57",brand:"GOPRO",name:"GOPRO HERO11 BLACK",priceIn:2750,priceEx:2500},
  {id:"56",brand:"Sony",name:"FDR-X3000R",priceIn:3190,priceEx:2900},
  {id:"55",brand:"DJI",name:"OSMO MOBILE 3",priceIn:1210,priceEx:1100},
  {id:"54",brand:"DJI",name:"OSMO MOBILE 5",priceIn:1320,priceEx:1200},
  {id:"53",brand:"DJI",name:"OSMO MOBILE 6",priceIn:1650,priceEx:1500},
  {id:"52",brand:"FLIR Systems",name:"サーモグラフィカメラ [FLIR ONE PRO + iPadセット]",priceIn:4400,priceEx:4000},
  {id:"44",brand:"Sony",name:"HXR-NX30J",priceIn:4400,priceEx:4000},
  {id:"33",brand:"Sony",name:"FX6 [CFexpress TypeA 160GB付属]",priceIn:14300,priceEx:13000},
  {id:"42",brand:"Sony",name:"HXR-NX70J",priceIn:5500,priceEx:5000},
  {id:"47",brand:"Sony",name:"ZV-1II [シューティンググリップ付]",priceIn:2970,priceEx:2700},
  {id:"46",brand:"Sony",name:"ZV-E1[シューティンググリップ付]",priceIn:4400,priceEx:4000},
  {id:"37",brand:"Sony",name:"MEAD-SD02",priceIn:550,priceEx:500},
  {id:"30",brand:"No Brand",name:"片耳ヘッドセット型イヤホンマイク",priceIn:550,priceEx:500},
  {id:"29",brand:"No Brand",name:"USB-C LAN変換アダプター",priceIn:550,priceEx:500},
  {id:"28",brand:"Canon",name:"LASER POINTER PR80-GC",priceIn:1100,priceEx:1000},
  {id:"27",brand:"Blackmagic Design",name:"UltraStudio HD Mini [液晶パネル付]",priceIn:3300,priceEx:3000},
  {id:"25",brand:"Blackmagic Design",name:"ATEM Mini Pro ISO",priceIn:4400,priceEx:4000},
  {id:"24",brand:"PAGE ONE",name:"Prompter Duo",priceIn:4400,priceEx:4000},
  {id:"463",brand:"Bi Rod",name:"Bi Wireless Line 10m",priceIn:660,priceEx:600},
  {id:"464",brand:"Bi Rod",name:"Bi Rod 6G-2000 [58cm〜200cm 700g]",priceIn:990,priceEx:900},
  {id:"465",brand:"GOPRO",name:"GOPROメディアモッド [HERO13/12/11/10/9用]",priceIn:550,priceEx:500},
  {id:"467",brand:"GOPRO",name:"Macroレンズモッド[HERO13用]",priceIn:550,priceEx:500},
  {id:"468",brand:"GOPRO",name:"El Grande [97cm延長ポール]",priceIn:550,priceEx:500},
  {id:"91",brand:"GOPRO",name:"60m防水ハウジング [HERO13/12/11/10/9用]",priceIn:550,priceEx:500},
  {id:"92",brand:"GOPRO",name:"GOPRO HERO8用 60m防水ハウジング",priceIn:550,priceEx:500},
  {id:"470",brand:"SanDisk",name:"PRO-READER Multi Card [CF,SD,microSDカードリーダー]",priceIn:550,priceEx:500},
  {id:"469",brand:"GOPRO",name:"The Handler",priceIn:550,priceEx:500},
  {id:"471",brand:"GOPRO",name:"SHORTY",priceIn:550,priceEx:500},
  {id:"96",brand:"GOPRO",name:"ハンド+リストストラップ",priceIn:550,priceEx:500},
  {id:"97",brand:"GOPRO",name:"チェストハーネス",priceIn:550,priceEx:500},
  {id:"98",brand:"GOPRO",name:"ジョーズフレックスクランプ",priceIn:550,priceEx:500},
  {id:"99",brand:"GOPRO",name:"ヘッドストラップ",priceIn:550,priceEx:500},
  {id:"474",brand:"GOPRO",name:"マグネティック スイベルクリップ",priceIn:550,priceEx:500},
  {id:"475",brand:"No Brand",name:"ヘルメット [ウェアラブルカメラ取付仕様]",priceIn:550,priceEx:500},
  {id:"476",brand:"Kenko",name:"3〜3.5inch用液晶フード [5R,Z90,X70他]",priceIn:550,priceEx:500},
  {id:"110",brand:"Kenko",name:"R-CROSS SCREEN [72mm]",priceIn:396,priceEx:360},
  {id:"107",brand:"Raynox",name:"HDP-7880ES [62,58mm 0.79倍 ワイドコンバージョンレンズ]",priceIn:935,priceEx:850},
  {id:"104",brand:"ZUNOW",name:"FHV-055[72mm 0.55倍フィッシュアイ]",priceIn:1980,priceEx:1800},
  {id:"102",brand:"ZUNOW",name:"WCX-80 [72mm ワイドコンバージョンレンズ]",priceIn:1100,priceEx:1000},
  {id:"202",brand:"ZUNOW",name:"72mm→62mm変換リング[WCX-80用]",priceIn:330,priceEx:300},
  {id:"105",brand:"Raynox",name:"HDP-2800ES [52,49,43,37mm 0.28倍 フィッシュアイ]",priceIn:1980,priceEx:1800},
  {id:"108",brand:"Kenko",name:"プロクサー[接写レンズ]3枚セット [72mm]",priceIn:495,priceEx:450},
  {id:"109",brand:"Kenko",name:"NDフィルター 3枚セット [105mm]",priceIn:2750,priceEx:2500},
  {id:"204",brand:"Kenko",name:"プロクサー[接写レンズ]3枚セット [62mm]",priceIn:495,priceEx:450},
  {id:"477",brand:"CANARE",name:"12G-SDIケーブル 3m [D5.5UHDC]",priceIn:550,priceEx:500},
  {id:"478",brand:"CANARE",name:"12G-SDIケーブル 10m [D5.5UHDC]",priceIn:1100,priceEx:1000},
  {id:"479",brand:"CANARE",name:"12G-SDIケーブル 20m [D5.5UHDC]",priceIn:1540,priceEx:1400},
  {id:"480",brand:"CANARE",name:"12G-SDIケーブル 30m [D5.5UHDC]",priceIn:1980,priceEx:1800},
  {id:"481",brand:"CANARE",name:"12G-SDIケーブル 50m [D5.5UHDC]",priceIn:2970,priceEx:2700},
  {id:"482",brand:"CANARE",name:"12G-SDIケーブル 100m [D5.5UHDC]",priceIn:3850,priceEx:3500},
  {id:"483",brand:"CANARE",name:"3G/HD-SDIケーブル 2m [5CFW]",priceIn:330,priceEx:300},
  {id:"484",brand:"CANARE",name:"3G/HD-SDIケーブル 5m [5CFW]",priceIn:330,priceEx:300},
  {id:"485",brand:"CANARE",name:"3G/HD-SDIケーブル 10m [5CFW]",priceIn:550,priceEx:500},
  {id:"486",brand:"CANARE",name:"3G/HD-SDIケーブル 20m [5CFW]",priceIn:770,priceEx:700},
  {id:"487",brand:"CANARE",name:"3G/HD-SDIケーブル 30m [5CFW]",priceIn:990,priceEx:900},
  {id:"488",brand:"CANARE",name:"3G/HD-SDIケーブル 50m [5CFW]",priceIn:1100,priceEx:1000},
  {id:"378",brand:"Sony",name:"FE PZ 16-35mm F4 G [SELP1635G]",priceIn:3080,priceEx:2800},
  {id:"379",brand:"Sony",name:"FE24-50mm F2.8 G [SEL2450G]",priceIn:3080,priceEx:2800},
  {id:"380",brand:"Sony",name:"FE20-70mm F4 G [SEL2070G]",priceIn:3080,priceEx:2800},
  {id:"381",brand:"Sony",name:"FE28-60mm F4-5.6 [SEL2860]",priceIn:2420,priceEx:2200},
  {id:"382",brand:"Sony",name:"FE70-200mm F4 Macro G OSS II [SEL70200G2]",priceIn:3520,priceEx:3200},
  {id:"147",brand:"Sony",name:"FE35mm F1.4 GM [SEL35F14GM]",priceIn:3080,priceEx:2800},
  {id:"149",brand:"Sony",name:"FE50mm F1.2 GM [SEL50F12GM]",priceIn:3080,priceEx:2800},
  {id:"150",brand:"Sony",name:"Planar T FE50mm F1.4 ZA [SEL50F14Z]",priceIn:3080,priceEx:2800},
  {id:"152",brand:"Sony",name:"FE85mm F1.4 GM [SEL85F14GM]",priceIn:3080,priceEx:2800},
  {id:"153",brand:"Sony",name:"FE90mm F2.8 Macro G OSS [SEL90M28G]",priceIn:3080,priceEx:2800},
  {id:"156",brand:"Canon",name:"EF24-70mm F2.8L II USM",priceIn:3080,priceEx:2800},
  {id:"157",brand:"Canon",name:"EF70-200mm F2.8L IS II USM",priceIn:3080,priceEx:2800},
  {id:"158",brand:"Canon",name:"EF16-35mm F2.8L II USM",priceIn:3080,priceEx:2800},
  {id:"159",brand:"Canon",name:"EF100mm F2.8Lマクロ IS USM",priceIn:3080,priceEx:2800},
  {id:"161",brand:"Canon",name:"EF50mm F1.2L USM",priceIn:3080,priceEx:2800},
  {id:"162",brand:"Canon",name:"EF40mm F2.8 STM",priceIn:2200,priceEx:2000},
  {id:"163",brand:"Canon",name:"EF28mm F1.8 USM",priceIn:2200,priceEx:2000},
  {id:"164",brand:"Canon",name:"EF20mm F2.8 USM",priceIn:2200,priceEx:2000},
  {id:"165",brand:"Canon",name:"EF25II エクステンションチューブ",priceIn:990,priceEx:900},
  {id:"489",brand:"Canon",name:"EXTENDER EF 2×III",priceIn:2200,priceEx:2000},
  {id:"166",brand:"Panasonic",name:"LUMIX G VARIO 7-14mm/F4.0 ASPH. [H-F007014]",priceIn:2200,priceEx:2000},
  {id:"168",brand:"Panasonic",name:"LEICA DG VARIO-SUMMILUX 10-25mm/F1.7 ASPH. [H-X1025]",priceIn:3300,priceEx:3000},
  {id:"169",brand:"Panasonic",name:"LUMIX G X VARIO 12-35mm/F2.8 II ASPH. [H-HSA12035]",priceIn:2200,priceEx:2000},
  {id:"170",brand:"Panasonic",name:"LEICA DG VARIO-ELMARIT 12-60mm/F2.8-4.0 ASPH. [H-ES12060]",priceIn:2200,priceEx:2000},
  {id:"171",brand:"Panasonic",name:"LUMIX G X VARIO 35-100mm/F2.8 II [H-HSA35100]",priceIn:2200,priceEx:2000},
  {id:"172",brand:"Panasonic",name:"LUMIX G VARIO 14-140mm/F3.5-5.6 ASPH. [H-FSA14140]",priceIn:2200,priceEx:2000},
  {id:"173",brand:"Panasonic",name:"LEICA DG SUMMILUX 12mm/F1.4 ASPH. [H-X012]",priceIn:2640,priceEx:2400},
  {id:"167",brand:"Panasonic",name:"LEICA DG VARIO-ELMARIT 8-18mm/F2.8-4.0 ASPH. [H-E08018]",priceIn:2640,priceEx:2400},
  {id:"174",brand:"Panasonic",name:"LEICA DG SUMMILUX 25mm/F1.4 II ASPH. [H-XA025]",priceIn:2200,priceEx:2000},
  {id:"79",brand:"Sony",name:"BP-U35 [Z200,FX6用]",priceIn:495,priceEx:450},
  {id:"80",brand:"Sony",name:"BP-U70 [Z200,FX6用]",priceIn:660,priceEx:600},
  {id:"185",brand:"Canon",name:"LP-E6NH",priceIn:550,priceEx:500},
  {id:"180",brand:"DJI",name:"BG30グリップ [RS4,RS3,RS2用]",priceIn:990,priceEx:900},
  {id:"179",brand:"DIGITALFOTO",name:"ARES Z Axis Spring Dual Handle",priceIn:2750,priceEx:2500},
  {id:"491",brand:"Manfrotto",name:"FAST GimBoom カーボン [MVGBF-CF]",priceIn:990,priceEx:900},
  {id:"492",brand:"Sony",name:"RM-VPR1",priceIn:550,priceEx:500},
  {id:"186",brand:"Canon",name:"LC-E6 [LP-E6用]",priceIn:550,priceEx:500},
  {id:"493",brand:"Kenko",name:"プロクサー[接写レンズ]3枚セット [77mm]",priceIn:495,priceEx:450},
  {id:"196",brand:"Sennheiser",name:"MKE400",priceIn:1100,priceEx:1000},
  {id:"197",brand:"Panasonic",name:"DMW-XLR1",priceIn:2200,priceEx:2000},
  {id:"494",brand:"SmallRig",name:"α7sIII/α7IV/α7RV用ケージ",priceIn:990,priceEx:900},
  {id:"198",brand:"Sony",name:"XLR-K2M",priceIn:1980,priceEx:1800},
  {id:"200",brand:"Sony",name:"MRW-G2 [CFexpress Type Aカードリーダー]",priceIn:550,priceEx:500},
  {id:"199",brand:"Sony",name:"MRW-G1 [CFexpress Type B/XQDカードリーダー]",priceIn:550,priceEx:500},
  {id:"201",brand:"Sony",name:"SBAC-US30 [SxSカードリーダー]",priceIn:1100,priceEx:1000},
  {id:"232",brand:"Sony",name:"CEA-G320T [CFexpress TypeA 320GB]",priceIn:1980,priceEx:1800},
  {id:"231",brand:"Sony",name:"CEA-G640T [CFexpress TypeA 640GB]",priceIn:3960,priceEx:3600},
  {id:"233",brand:"Sony",name:"CEA-G160T [CFexpress TypeA 160GB]",priceIn:990,priceEx:900},
  {id:"234",brand:"Sony",name:"CEA-G80T [CFexpress TypeA 80GB]",priceIn:880,priceEx:800},
  {id:"235",brand:"Sony",name:"QD-G240F [XQDカード 240GB]",priceIn:990,priceEx:900},
  {id:"236",brand:"Sony",name:"QD-G128E [XQDカード 128GB]",priceIn:550,priceEx:500},
  {id:"237",brand:"SanDisk",name:"CFast2.0カード 256GB",priceIn:1650,priceEx:1500},
  {id:"238",brand:"SanDisk",name:"CFast2.0カード 128GB",priceIn:1485,priceEx:1350},
  {id:"240",brand:"SanDisk",name:"CFカード 64GB",priceIn:495,priceEx:450},
  {id:"241",brand:"SanDisk",name:"CFカード 32GB",priceIn:297,priceEx:270},
  {id:"242",brand:"SanDisk",name:"SDカード 1TB [Extreme PRO UHS-I V30]",priceIn:990,priceEx:900},
  {id:"243",brand:"SanDisk",name:"SDカード 512GB [Extreme PRO UHS-I V30]",priceIn:825,priceEx:750},
  {id:"239",brand:"SanDisk",name:"CFカード 128GB",priceIn:990,priceEx:900},
  {id:"2",brand:"No Brand",name:"44TB RAID HDD [22TB x2 ストライピング]",priceIn:2200,priceEx:2000},
  {id:"3",brand:"No Brand",name:"40TB RAID HDD [20TB x2 ストライピング]",priceIn:1980,priceEx:1800},
  {id:"4",brand:"No Brand",name:"36TB RAID HDD [18TB x2 ストライピング]",priceIn:1760,priceEx:1600},
  {id:"5",brand:"No Brand",name:"32TB RAID HDD [16TB x2 ストライピング]",priceIn:1595,priceEx:1450},
  {id:"7",brand:"No Brand",name:"24TB RAID HDD [12TB x2 ストライピング]",priceIn:1155,priceEx:1050},
  {id:"8",brand:"No Brand",name:"16TB RAID HDD [8TB x2 ストライピング]",priceIn:770,priceEx:700},
  {id:"9",brand:"No Brand",name:"22TB RAID HDD [22TB x2 ミラーリング]",priceIn:2200,priceEx:2000},
  {id:"385",brand:"No Brand",name:"18TB RAID HDD [18TB x2 ミラーリング]",priceIn:1760,priceEx:1600},
  {id:"10",brand:"No Brand",name:"20TB RAID HDD [20TB x2 ミラーリング]",priceIn:1980,priceEx:1800},
  {id:"11",brand:"No Brand",name:"12TB RAID HDD [12TB x2 ミラーリング]",priceIn:1155,priceEx:1050},
  {id:"12",brand:"No Brand",name:"8TB RAID HDD [8TB x2 ミラーリング]",priceIn:770,priceEx:700},
  {id:"383",brand:"No Brand",name:"48TB RAID HDD [24TB x2 ストライピング]",priceIn:2420,priceEx:2200},
  {id:"448",brand:"No Brand",name:"24TB RAID HDD [24TB x2 ミラーリング]",priceIn:2420,priceEx:2200},
  {id:"449",brand:"No Brand",name:"16TB RAID HDD [16TB x2 ミラーリング]",priceIn:1595,priceEx:1450},
  {id:"499",brand:"Sony",name:"SDカード 256GB [UHS-II V90][SF-G256T][TOUGH]",priceIn:880,priceEx:800},
  {id:"244",brand:"SanDisk",name:"SDカード 256GB [Extreme PRO UHS-I V30]",priceIn:440,priceEx:400},
  {id:"245",brand:"SanDisk",name:"SDカード 256GB [ultra UHS-I]",priceIn:440,priceEx:400},
  {id:"246",brand:"Sony",name:"SDカード 128GB [UHS-II V90][SF-G128T][TOUGH]",priceIn:363,priceEx:330},
  {id:"248",brand:"SanDisk",name:"SDカード 128GB [Extreme PRO UHS-I V30]",priceIn:330,priceEx:300},
  {id:"249",brand:"Sony",name:"SDカード 64GB [UHS-II V90][SF-G64T][TOUGH]",priceIn:176,priceEx:160},
  {id:"247",brand:"SanDisk",name:"SDカード 128GB [Extreme PRO UHS-Ⅱ V90]",priceIn:363,priceEx:330},
  {id:"250",brand:"SanDisk",name:"SDカード 64GB [Extreme PRO UHS-Ⅱ]",priceIn:176,priceEx:160},
  {id:"251",brand:"SanDisk",name:"SDカード 64GB [Extreme PRO UHS-I V30]",priceIn:154,priceEx:140},
  {id:"252",brand:"SanDisk",name:"SDカード 32GB [Extreme PRO UHS-Ⅱ V90]",priceIn:88,priceEx:80},
  {id:"253",brand:"SanDisk",name:"SDカード 32GB [Extreme PRO UHS-I V30]",priceIn:77,priceEx:70},
  {id:"254",brand:"SanDisk",name:"MicroSDカード 512GB [Extreme PRO UHS-I V30]",priceIn:990,priceEx:900},
  {id:"255",brand:"SanDisk",name:"MicroSDカード 256GB [Extreme UHS-I V30]",priceIn:572,priceEx:520},
  {id:"256",brand:"SanDisk",name:"MicroSDカード 128GB [Extreme UHS-I V30]",priceIn:363,priceEx:330},
  {id:"257",brand:"SanDisk",name:"MicroSDカード 64GB [Extreme PRO UHS-I V30]",priceIn:176,priceEx:160},
  {id:"258",brand:"SanDisk",name:"MicroSDカード 64GB [ultra UHS-I]",priceIn:154,priceEx:140},
  {id:"259",brand:"SanDisk",name:"MicroSDカード 32GB [ultra UHS-I]",priceIn:88,priceEx:80},
  {id:"260",brand:"Sony",name:"メモリースティック PRO-HG DUO 32GB [MS-HX32A]",priceIn:550,priceEx:500},
  {id:"14",brand:"Western Digital",name:"4TB WD BLACK P50 SSD",priceIn:495,priceEx:450},
  {id:"184",brand:"Wise Advanced",name:"Wise SSD 2TB [BMPCC6K Pro/6K推奨SSD]",priceIn:1210,priceEx:1100},
  {id:"13",brand:"No Brand",name:"8TB SSD [2.5inch]",priceIn:770,priceEx:700},
  {id:"16",brand:"No Brand",name:"2TB SSD [2.5inch]",priceIn:330,priceEx:300},
  {id:"15",brand:"No Brand",name:"4TB SSD [2.5inch]",priceIn:440,priceEx:400},
].map(p=>({...p,fullName:`${p.brand} ${p.name}`}));

const PRESET_CUSTOMERS = [
  {id:"c001",name:"菊池様",invoiceName:"菊池様",zipCode:"",address:"",contact:"",paymentCycle:"スクエア",discountRate:0,splitInvoice:false,notes:"個人・都度払い",specialPrices:[]},
  {id:"c002",name:"安達様",invoiceName:"安達様",zipCode:"",address:"",contact:"",paymentCycle:"スクエア",discountRate:0,splitInvoice:false,notes:"個人・都度払い",specialPrices:[]},
  {id:"c003",name:"平山[松林]寛太様",invoiceName:"平山[松林]寛太様",zipCode:"",address:"",contact:"",paymentCycle:"スクエア",discountRate:0,splitInvoice:false,notes:"個人・都度払い",specialPrices:[]},
  {id:"c004",name:"中村翔悟様",invoiceName:"中村翔悟様",zipCode:"",address:"",contact:"",paymentCycle:"スクエア",discountRate:0,splitInvoice:false,notes:"個人・都度払い",specialPrices:[]},
  {id:"c005",name:"株式会社ソリスプロデュース",invoiceName:"株式会社ソリスプロデュース",zipCode:"150-0012",address:"東京都渋谷区広尾5-17-10 EastWest3F",contact:"ﾌﾟﾛﾃﾞｭｰｻｰ 奈良部 隆久様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c006",name:"株式会社サジットメディア",invoiceName:"株式会社 サジットメディア",zipCode:"104-0061",address:"東京都中央区銀座7-10-6 8F",contact:"ﾌﾟﾛﾃﾞｭｰｻｰ 中野 秀俊様",paymentCycle:"月末締め 翌々月末日",discountRate:8,splitInvoice:false,notes:"8掛け",specialPrices:[]},
  {id:"c007",name:"株式会社サルベージ",invoiceName:"株式会社 サルベージ",zipCode:"105-0021",address:"東京都港区東新橋1-8-3 汐留エッジ 7F",contact:"",paymentCycle:"月末締め 翌々月5日",discountRate:0,splitInvoice:false,notes:"光畑さん&吉末さんへメールで送る。郵送いらない",specialPrices:[]},
  {id:"c008",name:"株式会社ブル",invoiceName:"株式会社 ブル",zipCode:"107-0052",address:"東京都港区赤坂3-5-2 ｻﾝﾖｰ赤坂ﾋﾞﾙ 4階",contact:"下山田淳様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"メールで送る 郵送なし",specialPrices:[]},
  {id:"c009",name:"株式会社オレンジ",invoiceName:"株式会社 オレンジ",zipCode:"104-0061",address:"東京都中央区銀座4-13-11 銀座M&Sビル 3F",contact:"香月 信様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"メールで送る 郵送なし",specialPrices:[]},
  {id:"c010",name:"株式会社いまじんCR",invoiceName:"株式会社 いまじんCR",zipCode:"105-0004",address:"東京都港区西新橋4-21-3 新橋東急ビル9階",contact:"田中様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c011",name:"株式会社テレビング",invoiceName:"株式会社 テレビング",zipCode:"105-0014",address:"東京都港区芝3-43-11 三輪ビル 2階",contact:"制作部 木下 幸治様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c012",name:"有限会社桝井論平事務所",invoiceName:"有限会社 桝井論平事務所",zipCode:"150-0041",address:"東京都渋谷区神南1-5-14 三船ビル 501",contact:"菊池様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c013",name:"ジュノー株式会社",invoiceName:"ジュノー株式会社",zipCode:"980-0804",address:"宮城県仙台市青葉区大町2-3-12-302",contact:"谷津様",paymentCycle:"月末締め 翌々月25日",discountRate:0,splitInvoice:false,notes:"※2025/05〜谷津様宛",specialPrices:[]},
  {id:"c014",name:"株式会社ネオテック",invoiceName:"株式会社 ネオテック",zipCode:"150-0047",address:"東京都渋谷区神山町7-10 COI渋谷神山町ビル 401",contact:"Vロケ技術部 前野孝弘様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"郵送",specialPrices:[]},
  {id:"c015",name:"有限会社ル・スポール",invoiceName:"有限会社ル・スポール",zipCode:"151-0051",address:"東京都渋谷区千駄ヶ谷4-27-1 神宮外苑ビル 5階",contact:"西山様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c016",name:"株式会社アイネクスト",invoiceName:"株式会社アイネクスト",zipCode:"131-0041",address:"東京都墨田区八広4-28-13 小林ハウス 1F",contact:"中西様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"PDFで送る",specialPrices:[]},
  {id:"c017",name:"株式会社スウィッシュ・ライン",invoiceName:"株式会社 スウィッシュ・ライン",zipCode:"108-0023",address:"東京都港区芝浦3-11-4 SJ-SHIBAURA",contact:"関根様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"10月からスウィッシュラインさん",specialPrices:[]},
  {id:"c018",name:"シンフォニティ株式会社",invoiceName:"シンフォニティ株式会社",zipCode:"102-0093",address:"東京都千代田区平河町2-5-3 パークフレックス平河町 B1F",contact:"菅原 雅史様",paymentCycle:"月末締め 翌月末日",discountRate:9,splitInvoice:false,notes:"9掛け。メールで送る。",specialPrices:[]},
  {id:"c019",name:"株式会社東京ティラノサウルス",invoiceName:"株式会社 東京ティラノサウルス",zipCode:"106-0044",address:"東京都港区東麻布3-7-3 東麻布久永ビル 5F",contact:"木村いさむ様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"2024年11月売上分から翌々月入金ペース",specialPrices:[]},
  {id:"c020",name:"日本テレビ放送網株式会社",invoiceName:"日本テレビ放送網株式会社",zipCode:"105-7444",address:"東京都港区東新橋1-6-1 日本テレビタワー5階",contact:"白川 大介様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける。FAXあり",specialPrices:[]},
  {id:"c021",name:"株式会社ブームアップ",invoiceName:"株式会社 ブームアップ",zipCode:"150-0021",address:"東京都港区東新橋2-18-3 ルネパルティーレ 4階",contact:"斎藤一宏様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c022",name:"株式会社日テレ アックスオン",invoiceName:"株式会社日テレ アックスオン",zipCode:"105-0021",address:"東京都港区東新橋1-2-17 住友不動産汐留ウイング 8F",contact:"小林 茜様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c023",name:"株式会社ヌーベルバーグ",invoiceName:"株式会社 ヌーベルバーグ",zipCode:"102-0081",address:"東京都千代田区四番町5-6 四番町ビル1号館 5F",contact:"",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c024",name:"株式会社BULLBULL",invoiceName:"株式会社 BULLBULL",zipCode:"151-0051",address:"東京都渋谷区千駄ヶ谷3-31-7",contact:"",paymentCycle:"月末締め 翌々月10日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c025",name:"株式会社TBSテレビ",invoiceName:"株式会社 TBSテレビ",zipCode:"107-8006",address:"東京都港区赤坂5-3-6 TBS放送センター",contact:"",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c026",name:"株式会社メディア・リース",invoiceName:"株式会社メディア・リース",zipCode:"107-0052",address:"東京都港区赤坂5-4-17 SCビル赤坂7F",contact:"小川様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c027",name:"有限会社特殊映材社",invoiceName:"有限会社 特殊映材社",zipCode:"106-0041",address:"東京都港区麻布台1-9-5",contact:"竹花 幸輝様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c028",name:"株式会社ジーリンクスタジオ",invoiceName:"株式会社ジーリンクスタジオ",zipCode:"105-0014",address:"東京都港区芝3-12-1 いちご芝公園ﾋﾞﾙ 7F",contact:"ﾚﾝﾀﾙ事業部 課長 佐々木 健様",paymentCycle:"月末締め 翌々月末日",discountRate:8,splitInvoice:false,notes:"8掛け",specialPrices:[]},
  {id:"c029",name:"株式会社BRAISE",invoiceName:"株式会社BRAISE",zipCode:"107-0052",address:"東京都港区赤坂5-4-6 赤坂三辻ビル 3F",contact:"",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c030",name:"株式会社タリー",invoiceName:"株式会社タリー",zipCode:"107-0052",address:"東京都港区赤坂6-4-19 赤坂サントミビル 4F",contact:"代表取締役 藤江広大様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c031",name:"株式会社オールミックス",invoiceName:"株式会社 オールミックス",zipCode:"107-0052",address:"東京都港区赤坂2-16-20 トリオ赤坂ビル 2F",contact:"代表取締役社長 江川智之様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"",specialPrices:[]},
  {id:"c032",name:"株式会社ニユーテレス",invoiceName:"株式会社ニユーテレス",zipCode:"135-0064",address:"東京都江東区青海1-1-20 ﾀﾞｲﾊﾞｰｼﾃｨ東京ｵﾌｨｽﾀﾜｰ 16階",contact:"営業ｾﾝﾀｰ 技術管理部 部長 大島 一高様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c033",name:"株式会社バンエイト",invoiceName:"株式会社バンエイト",zipCode:"135-0064",address:"東京都江東区青海一丁目1番20号 ダイバーシティ東京オフィスタワー 16階",contact:"制作センター 制作技術部 中島誠様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:false,notes:"PDFで中島様へメール",specialPrices:[]},
  {id:"c034",name:"株式会社クリーク・アンド・リバー社",invoiceName:"株式会社クリーク・アンド・リバー社",zipCode:"105-0004",address:"東京都港区新橋四丁目1番1号 新虎通りCORE",contact:"ｴﾝﾀﾃｲﾝﾒﾝﾄ・ﾌﾟﾛﾃﾞｭｰｽ・ｸﾞﾙｰﾌﾟ 武蔵祐輝様",paymentCycle:"月末締め 翌月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c035",name:"株式会社IVS41",invoiceName:"株式会社IVS41",zipCode:"105-0014",address:"東京都港区芝3-15-15 櫻井ビル 7F",contact:"執行役員 映像事業本部 澤井 慎幸様",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:false,notes:"PDF",specialPrices:[]},
  {id:"c036",name:"オフィスながも株式会社",invoiceName:"オフィスながも株式会社",zipCode:"105-0003",address:"東京都港区西新橋1-17-6 高嶋ビル2階",contact:"",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c037",name:"株式会社N.G.M",invoiceName:"株式会社N.G.M",zipCode:"105-0003",address:"東京都港区西新橋1-17-6 高嶋ビル2階",contact:"",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける",specialPrices:[]},
  {id:"c038",name:"株式会社ディ・コンプレックス",invoiceName:"株式会社 ディ・コンプレックス",zipCode:"106-0032",address:"東京都港区六本木3-16-35 イースト六本木ビル",contact:"",paymentCycle:"月末締め 翌々月末日",discountRate:0,splitInvoice:true,notes:"番組ごとに請求書を分ける。gyoumu@d-com.co.jpへ送る",specialPrices:[]},
];

const K = { p:"olqP7", c:"olqC7", r:"olqR7", sync:"olqSync7", inv:"olqInv7", pw:"olqPw7", dno:"olqDNo7", ino:"olqINo7" };
const calcDays = (s,e) => (!s||!e) ? 0 : Math.max(0, Math.floor((new Date(e)-new Date(s))/86400000)+1);

// シンプルなパスワード入力コンポーネント
function PwInput({onOk, onCancel}) {
  const [v, setV] = React.useState("");
  return (
    <div>
      <input type="password" value={v} onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")onOk(v);if(e.key==="Escape")onCancel();}}
        placeholder="パスワードを入力" autoFocus
        style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:6,padding:"8px 10px",fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>onOk(v)}
          style={{flex:1,background:"#0f172a",color:"#fff",border:"none",borderRadius:6,padding:"8px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>確認</button>
        <button onClick={onCancel}
          style={{flex:1,background:"#e2e8f0",color:"#475569",border:"none",borderRadius:6,padding:"8px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
      </div>
    </div>
  );
}

// 終了未定月極案件を月ごとに展開する
function expandMonthlyOpenRecord(r, calcBillingDaysFn, todayFn) {
  const results = [];
  if (!r.startDate) return results;
  const startD = new Date(r.startDate + 'T00:00:00');
  const returnD = r.returnDate ? new Date(r.returnDate + 'T00:00:00') : null;
  const todayD  = new Date(todayFn() + 'T00:00:00');
  const limitD  = returnD || todayD;
  const rLns = (r.lines && r.lines.length) ? r.lines
    : [{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,
        dailyUnitPrice:r.dailyUnitPrice||r.unitPrice,
        quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],
        equipmentName:r.equipmentName||""}];

  let n = 0;
  while (n <= 120) {
    const pStart = new Date(startD);
    pStart.setMonth(pStart.getMonth() + n);
    if (pStart > limitD) break;

    const pEnd = new Date(pStart);
    pEnd.setMonth(pEnd.getMonth() + 1);
    pEnd.setDate(pEnd.getDate() - 1);

    const _pad = n=>String(n).padStart(2,"0");
    const bMonth = `${pStart.getFullYear()}-${_pad(pStart.getMonth()+1)}`;
    const pStartStr = `${pStart.getFullYear()}-${_pad(pStart.getMonth()+1)}-${_pad(pStart.getDate())}`;
    const pEndStr   = `${pEnd.getFullYear()}-${_pad(pEnd.getMonth()+1)}-${_pad(pEnd.getDate())}`;

    if (returnD && returnD >= pStart && returnD <= pEnd) {
      // 戻り月：部分期間を日極で計上
      const days = Math.max(1, Math.ceil((returnD - pStart) / 86400000) + 1);
      const bDays = calcBillingDaysFn(days);
      const lines = rLns.map(ln => {
        const dp = Number(ln.dailyUnitPrice || ln.unitPrice || 0);
        const qty = Number(ln.quantity) || 1;
        return {...ln, unitPrice: dp, amount: dp * qty * bDays};
      });
      const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
      results.push({
        ...r, id:r.id+'__ret__'+bMonth,
        startDate:pStartStr, endDate:r.returnDate,
        billingType:'daily', billingDays:bDays, days:bDays,
        isReturnEntry:true, isOpenMonthly:true, amount:amt, lines,
        _billingMonth:bMonth,
      });
      break;
    } else {
      // 通常月：1ヶ月分
      const lines = rLns.map(ln => {
        const up = Number(ln.unitPrice || 0);
        const qty = Number(ln.quantity) || 1;
        return {...ln, amount: up * qty * 1};
      });
      const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
      results.push({
        ...r, id:r.id+'__mo__'+bMonth,
        startDate:pStartStr, endDate:pEndStr,
        billingType:'monthly', months:1,
        isMonthlyEntry:true, isOpenMonthly:true, amount:amt, lines,
        _billingMonth:bMonth,
      });
    }
    n++;
  }
  return results;
}



// オルク独自の請求日数計算ルール
// 1-4日: そのまま / 5日: 4日 / 6-7日: 5日 / ... / 26-31日: 15日
// 32日〜: 31日ごとにリセットして同じルールを再適用
function applyBillingTable(d) {
  if (d <= 0) return 0;
  if (d <= 4) return d;
  if (d === 5) return 4;
  if (d <= 7) return 5;
  if (d <= 9) return 6;
  if (d <= 11) return 7;
  if (d <= 13) return 8;
  if (d <= 15) return 9;
  if (d <= 17) return 10;
  if (d <= 19) return 11;
  if (d <= 21) return 12;
  if (d <= 23) return 13;
  if (d <= 25) return 14;
  return 15; // 26-31日
}
function calcBillingDays(actualDays) {
  if (actualDays <= 0) return 0;
  const cycles    = Math.floor(actualDays / 31);
  const remainder = actualDays % 31;
  return cycles * 15 + applyBillingTable(remainder);
}
const taxIn  = n => Math.round((n||0)*1.1);
const taxEx  = n => Math.round((n||0)/1.1);
const fmt    = n => `¥${Number(n||0).toLocaleString()}`;
const fmtD   = d => d ? new Date(d).toLocaleDateString("ja-JP") : "―";
const uid    = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const today  = () => new Date().toISOString().slice(0,10);

function resolvePrice(prod, cust) {
  if (!prod) return 0;
  if (!cust) return prod.priceEx;
  const sp = (cust.specialPrices||[]).find(s => s.productId === prod.id);
  if (sp) return sp.price;
  const kake = Number(cust.discountRate)||0;
  if (kake > 0 && kake < 10) return Math.round(prod.priceEx * kake / 10);
  return prod.priceEx;
}

// 特別価格の製品名を製品マスタから動的解決（削除済み製品はフォールバック表示）
function spName(sp, products) {
  const p = products.find(x => x.id === sp.productId);
  return p ? p.fullName : (sp.productName || `[削除済:${sp.productId}]`);
}
// 特別価格リストから削除済み製品を除去し、productNameを最新に同期
function syncSPs(specialPrices, products) {
  return (specialPrices||[])
    .filter(sp => products.some(p => p.id === sp.productId))
    .map(sp => {
      const p = products.find(x => x.id === sp.productId);
      return { ...sp, productName: p ? p.fullName : sp.productName };
    });
}

// ---- データストア（Supabase版）----
const _TABLE = { [K.p]:'products', [K.c]:'customers', [K.r]:'cases' };

async function sGet(k) {
  try {
    if (_TABLE[k]) {
      const { data, error } = await supabase.from(_TABLE[k]).select('id, data');
      if (error) { console.error('sGet error', k, error); return null; }
      if (!data?.length) return null;
      return data.map(row => row.data);
    }
    if (k === K.inv) {
      const { data, error } = await supabase.from('invoices').select('id, data, is_locked');
      if (error) { console.error('sGet invoice error', error); return null; }
      if (!data?.length) return null;
      const result = {};
      data.forEach(row => { result[row.id] = { ...row.data, is_locked: row.is_locked }; });
      return result;
    }
    const { data } = await supabase.from('settings').select('value').eq('key', k).maybeSingle();
    return data?.value ?? null;
  } catch(e) { console.error('sGet exception', k, e); return null; }
}

async function sSet(k, val) {
  try {
    if (_TABLE[k]) {
      if (!Array.isArray(val)) return;
      const rows = val.map(item => ({ id: String(item.id), data: item, updated_at: new Date().toISOString() }));
      if (rows.length > 0) {
        await supabase.from(_TABLE[k]).upsert(rows, { onConflict: 'id' });
        const { data: existing } = await supabase.from(_TABLE[k]).select('id');
        const newIds = rows.map(r => r.id);
        const toDelete = (existing||[]).map(r=>r.id).filter(id => !newIds.includes(id));
        if (toDelete.length > 0) await supabase.from(_TABLE[k]).delete().in('id', toDelete);
      }
      return;
    }
    if (k === K.inv) {
      if (!val || typeof val !== 'object') return;
      const rows = Object.entries(val).map(([id, v]) => ({
        id, data: v, is_locked: v?.status === 'locked', updated_at: new Date().toISOString()
      }));
      if (rows.length > 0) await supabase.from('invoices').upsert(rows, { onConflict: 'id' });
      return;
    }
    if (k === K.pw) return;
    await supabase.from('settings').upsert({ key: k, value: String(val) }, { onConflict: 'key' });
  } catch(e) { console.error('sSet exception', k, e); }
}

async function verifyPw(inputPw) {
  const { data, error } = await supabase.rpc('verify_lock_password', { input_pw: inputPw });
  if (error) { console.error('verifyPw error', error); return false; }
  return !!data;
}

async function updateLockPw(newPw) {
  await supabase.rpc('update_lock_password', { new_pw: newPw });
}


// 検索絞り込み付きセレクト
const _INP={width:"100%",padding:"8px 11px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"};
function SearchableSelect({value, onChange, options, placeholder="選択...", style}){
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const filtered=q?options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())):options;
  const selected=options.find(o=>o.value===value);
  useEffect(()=>{
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);
  return(
    <div ref={ref} style={{position:"relative",...style}}>
      <div
        onClick={()=>{setOpen(v=>!v);setQ("");}}
        style={{..._INP,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}
      >
        <span style={{color:selected?"#0f172a":"#94a3b8",fontSize:13}}>{selected?selected.label:placeholder}</span>
        <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"#fff",border:"1.5px solid #2563eb",borderRadius:7,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden"}}>
          <input
            autoFocus
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="絞り込み..."
            style={{width:"100%",padding:"8px 11px",border:"none",borderBottom:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}}
          />
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {filtered.length===0
              ?<div style={{padding:"10px 14px",fontSize:12,color:"#94a3b8"}}>該当なし</div>
              :filtered.map(o=>(
                <div
                  key={o.value}
                  onClick={()=>{onChange(o.value);setOpen(false);setQ("");}}
                  style={{padding:"8px 14px",fontSize:13,cursor:"pointer",background:o.value===value?"#eff6ff":"#fff",color:o.value===value?"#2563eb":"#0f172a",fontWeight:o.value===value?700:400}}
                  onMouseEnter={e=>e.currentTarget.style.background=o.value===value?"#dbeafe":"#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background=o.value===value?"#eff6ff":"#fff"}
                >
                  {o.label}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

const Ico = ({d,size=16,color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <path d={d}/>
  </svg>
);
const I = {
  plus:"M12 5v14M5 12h14",
  edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  print:"M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  box:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  file:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  check:"M20 6L9 17l-5-5",
  x:"M18 6L6 18M6 6l12 12",
  search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

const S = {
  lbl:{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4},
  inp:{width:"100%",padding:"8px 11px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"},
  td:{border:"1px solid #d1d5db",padding:"6px 10px"},
  btn:(bg,sm)=>({background:bg,color:"#fff",border:"none",borderRadius:7,padding:sm?"6px 12px":"8px 16px",fontSize:sm?12:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}),
  ib:c=>({background:"none",border:`1.5px solid ${c}`,color:c,borderRadius:6,padding:"3px 7px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3,fontSize:12,whiteSpace:"nowrap"}),
  card:{background:"#fff",borderRadius:12,boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"},
};

function Toast({t}) {
  if (!t) return null;
  return (
    <div style={{position:"fixed",top:62,right:16,zIndex:9999,background:t.ok?"#166534":"#991b1b",color:"#fff",borderRadius:9,padding:"10px 16px",fontSize:13,fontWeight:600,boxShadow:"0 6px 24px rgba(0,0,0,.3)",display:"flex",alignItems:"center",gap:8,maxWidth:380}}>
      <Ico d={t.ok?I.check:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"} size={14}/>{t.msg}
    </div>
  );
}


// CORSプロキシ経由でOLQサイトHTMLを直接取得 → 正規表現でパース（AI不要）
async function fetchAllProducts(onMsg) {
  const results = [];
  const seenIds = new Set();
  let page = 1;
  let emptyCount = 0;

  while (emptyCount < 2) {
    onMsg && onMsg(`${page}ページ目取得中... (${results.length}件)`);

    const siteUrl = page === 1
      ? 'https://rental.olq.co.jp/?actmode=ItemList'
      : `https://rental.olq.co.jp/?pageno=${page}&actmode=ItemList`;

    // CORSプロキシ経由でHTMLを直接取得
    const proxies = [
      `https://corsproxy.io/?url=${encodeURIComponent(siteUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(siteUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(siteUrl)}`,
    ];

    let pageProds = [];
    let html = "";
    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
        if (res.ok) { html = await res.text(); if (html.length > 1000) break; }
      } catch {}
    }
    try {
      if (!html || html.length < 1000) throw new Error("全プロキシ失敗");

      onMsg && onMsg(`${page}ページ目 HTML ${html.length}bytes パース中...`);

      // 各製品リンクブロックで分割（<a href="...actmode=ItemDetail...">）
      const parts = html.split(/(?=<a\s[^>]*actmode=ItemDetail)/i);
      for (const part of parts) {
        const iidM = part.match(/iid=(\d+)/);
        if (!iidM) continue;
        const priceM = part.match(/¥([\d,]+)\/日/);
        if (!priceM) continue;

        const iid = iidM[1];
        const priceIn = parseInt(priceM[1].replace(/,/g, ''), 10);

        // HTMLタグを除去してテキスト行に分解
        const text = part
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<img[^>]*>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
          .replace(/\n{2,}/g, '\n').trim();

        // 価格より前の行からブランド・製品名を取得
        const priceIdx = text.indexOf('¥');
        const lines = text.slice(0, priceIdx)
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.includes('item_image') && !l.includes('.jpg') && !l.startsWith('http'));

        if (lines.length < 2) continue;
        const name  = lines[lines.length - 1];
        const brand = lines[lines.length - 2];

        pageProds.push({ id: iid, brand, name, priceIn });
      }

      onMsg && onMsg(`${page}ページ目: ${pageProds.length}件取得`);
    } catch(e) {
      onMsg && onMsg(`[ERROR p${page}] ${e.message || String(e)}`);
    } // end try

    if (!pageProds.length) {
      emptyCount++;
      page++;
      continue;
    }
    emptyCount = 0;
    for (const p of pageProds) {
      if (!p.id || seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      results.push({
        id:       p.id,
        brand:    p.brand,
        name:     p.name,
        priceIn:  p.priceIn,
        priceEx:  Math.round(p.priceIn / 1.1),
        fullName: `${p.brand} ${p.name}`.trim()
      });
    }
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  if (results.length < 10) throw new Error(`取得件数が少なすぎます (${results.length}件)`);
  return results;
}

// サイトデータと既存製品マスタをマージ
// - 新製品(idなし) → 先頭に追加
// - 既存製品(id一致) → brand/name/priceIn/priceEx をサイト側で上書き
// - サイトにない製品 → 削除せず残す（手動追加製品を保護）
function mergeProducts(siteProds, currentProds) {
  const siteMap = new Map(siteProds.map(p => [p.id, p]));
  const updated = currentProds.map(p => {
    const s = siteMap.get(p.id);
    if (!s) return p;
    return { ...p, brand: s.brand, name: s.name, priceIn: s.priceIn, priceEx: s.priceEx, fullName: s.fullName };
  });
  const existIds = new Set(currentProds.map(p => p.id));
  const added = siteProds.filter(p => !existIds.has(p.id));
  return [...added, ...updated];
}


export default function App() {
  // ---- Auth ----
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showImport,  setShowImport]  = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user?.user_metadata?.role === 'admin';

  // ---- App state ----
  const [products,  setProducts]  = useState(ALL_PRODUCTS);
  const [customers, setCustomers] = useState([]);
  const [records,   setRecords]   = useState([]);
  const [invoiceData, setInvoiceData] = useState({});
  const [tab,       setTab]       = useState("records");
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [toast,     setToast]     = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncMsg,    setSyncMsg]    = useState("");
  const [syncLog,    setSyncLog]    = useState([]);
  const [showLog,    setShowLog]    = useState(false);
  const [globalQ,    setGlobalQ]    = useState("");

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  // ---- 初期データロード ----
  useEffect(() => {
    if (!session) return;
    (async () => {
      const [p, c, r, inv, lastSync] = await Promise.all([
        sGet(K.p), sGet(K.c), sGet(K.r), sGet(K.inv), sGet(K.sync)
      ]);
      if (p?.length) setProducts(p);
      if (c?.length) { setCustomers(c); }
      else { setCustomers(PRESET_CUSTOMERS); await sSet(K.c, PRESET_CUSTOMERS); }
      if (r?.length) setRecords(r);
      if (inv) setInvoiceData(inv);
      if (lastSync !== today()) {
        setTimeout(() => autoSync(), 500);
      } else {
        setSyncStatus("synced");
      }
    })();
  }, [session]);

  // ---- Realtime（5PC同時同期）----
  useEffect(() => {
    if (!session) return;
    const reload = async (table) => {
      if (table === 'customers') { const d = await sGet(K.c); if(d?.length) setCustomers(d); }
      if (table === 'cases')     { const d = await sGet(K.r); if(d?.length) setRecords(d); }
      if (table === 'invoices')  { const d = await sGet(K.inv); if(d) setInvoiceData(d); }
    };
    const channels = ['customers','cases','invoices'].map(table =>
      supabase.channel(`rt_${table}`)
        .on('postgres_changes', { event:'*', schema:'public', table }, () => reload(table))
        .subscribe()
    );
    return () => channels.forEach(ch => supabase.removeChannel(ch));
  }, [session]);

  const autoSync = async (manual=false) => {
    if (syncStatus==="syncing") return;
    setSyncStatus("syncing");
    setSyncLog([]);
    try {
      const siteProds = await fetchAllProducts((msg) => { setSyncMsg(msg); setSyncLog(l => [...l, msg]); });
      const merged = mergeProducts(siteProds, products);
      const added   = merged.length - products.length;
      const changed = siteProds.filter(s => {
        const cur = products.find(p => p.id === s.id);
        return cur && (cur.priceIn !== s.priceIn || cur.name !== s.name || cur.brand !== s.brand);
      }).length;
      await saveProd(merged);
      await sSet(K.sync, today());
      setSyncStatus("synced");
      setSyncMsg("");
      if (manual) {
        const detail = [added>0&&`新製品+${added}件`, changed>0&&`更新${changed}件`].filter(Boolean).join(" / ");
        showToast(`同期完了（計${merged.length}件）${detail ? " — "+detail : ""}`);
      }
    } catch(e) {
      await sSet(K.sync, today());
      setSyncStatus(manual?"failed":"idle");
      setSyncMsg(e?.message||"");
      if (manual) showToast("同期に失敗しました: "+(e?.message||"不明なエラー"), false);
    }
  };

  const saveProd = async n => {
    setProducts(n);
    await sSet(K.p, n);
    // 製品マスタ変更時、全顧客の特別価格を自動同期
    const updated = customers.map(c => {
      if (!(c.specialPrices||[]).length) return c;
      const synced = syncSPs(c.specialPrices, n);
      if (synced.length === c.specialPrices.length && synced.every((s,i)=>s.productName===c.specialPrices[i].productName)) return c;
      return {...c, specialPrices: synced};
    });
    if (updated !== customers) { setCustomers(updated); await sSet(K.c, updated); }
  };
  const saveCust = async n => { setCustomers(n); await sSet(K.c, n); };
  const saveRec  = async n => { setRecords(n);   await sSet(K.r, n); };
  const saveInv  = async n => { setInvoiceData(n); await sSet(K.inv, n); };

  const invoiceGroups = {};
  const _addToGroup = (c, projKey, billingMonth, split, consolidate, entry) => {
    const key = `${entry.customerId}||${projKey}||${billingMonth}`;
    if (!invoiceGroups[key]) {
      invoiceGroups[key] = {
        customerId:entry.customerId, customer:c||null, customerName:c?.name||"不明",
        projectName:projKey, month:billingMonth, items:[], split, consolidate
      };
    }
    invoiceGroups[key].items.push(entry);
  };
  records.forEach(r => {
    const c = customers.find(x=>x.id===r.customerId);
    const split = c?.splitInvoice !== false;
    const projKey = split ? (r.projectName||"") : "";
    const consolidate = !!(c?.consolidateMonth);

    if (r.endDateOpen && r.billingType === 'monthly') {
      // 終了未定月極：月ごとに展開
      const entries = expandMonthlyOpenRecord(r, calcBillingDays, today);
      entries.forEach(entry => {
        _addToGroup(c, projKey, entry._billingMonth, split, consolidate, entry);
      });
    } else if (r.billingType === 'monthly' && r.startDate) {
      // 固定月数の月極：months分だけ展開
      const months_ = Number(r.months) || 1;
      const rLns = (r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];
      for (let n = 0; n < months_; n++) {
        const pStart = new Date(r.startDate + 'T00:00:00');
        pStart.setMonth(pStart.getMonth() + n);
        const pEnd = new Date(pStart);
        pEnd.setMonth(pEnd.getMonth() + 1);
        pEnd.setDate(pEnd.getDate() - 1);
        const pad = n=>String(n).padStart(2,"0");
        const bMonth = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}`;
        const pStartStr = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}-${pad(pStart.getDate())}`;
        const pEndStr = `${pEnd.getFullYear()}-${pad(pEnd.getMonth()+1)}-${pad(pEnd.getDate())}`;
        const lines = rLns.map(ln => {
          const up = Number(ln.unitPrice||0);
          const qty = Number(ln.quantity)||1;
          return {...ln, amount: up * qty * 1};
        });
        const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
        const entry = {...r, id:r.id+'__mo__'+bMonth,
          startDate:pStartStr, endDate:pEndStr,
          billingType:'monthly', months:1,
          isMonthlyEntry:true, amount:amt, lines,
          _billingMonth:bMonth};
        _addToGroup(c, projKey, bMonth, split, consolidate, entry);
      }
    } else {
      // 通常案件（日極）：既存ロジック
      let billingMonth = r.startDate?.slice(0,7)||"";
      if (consolidate && r.startDate && r.endDate) {
        const sm = r.startDate.slice(0,7);
        const em = r.endDate.slice(0,7);
        if (sm !== em) {
          const smEnd = new Date(sm.replace("-","/")+"/01");
          smEnd.setMonth(smEnd.getMonth()+1); smEnd.setDate(0);
          const smDays = calcDays(r.startDate, smEnd.toISOString().slice(0,10));
          const emDays = calcDays(new Date(em.replace("-","/")+"/01").toISOString().slice(0,10), r.endDate);
          billingMonth = smDays >= emDays ? sm : em;
        }
      }
      _addToGroup(c, projKey, billingMonth, split, consolidate, r);
    }
  });


  const TABS = [
    {id:"records",  label:"案件管理",    icon:I.list},
    {id:"delivery", label:"納品書",      icon:I.file},
    {id:"invoice",  label:"請求書",      icon:I.print},
    {id:"customers",label:"顧客管理",    icon:I.users},
    {id:"products", label:"製品マスタ",  icon:I.box},
  ];

  // ---- auth guard ----
  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"'Noto Sans JP',sans-serif",fontSize:14,color:"#64748b"}}>読み込み中...</div>
  );
  if (!session) return <LoginScreen />;
  if (showImport) return <ImportScreen onDone={()=>setShowImport(false)} showToast={showToast} setCustomers={setCustomers} setRecords={setRecords} setInvoiceData={setInvoiceData} setProducts={setProducts} />;

  return (
    <div style={{fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",minHeight:"100vh",background:"#f1f5f9",color:"#1e293b"}}>
      <Toast t={toast}/>


      {showLog && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowLog(false)}>
          <div style={{background:"#1e293b",color:"#e2e8f0",borderRadius:12,padding:24,maxWidth:700,width:"90%",maxHeight:"80vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <b style={{fontSize:14}}>🔍 同期デバッグログ</b>
              <button onClick={()=>setShowLog(false)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}}>✕</button>
            </div>
            <pre style={{fontSize:11,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-all",color:"#86efac"}}>
              {syncLog.length ? syncLog.join("\n") : "(ログなし — 再度同期を実行してください)"}
            </pre>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@media print{.app-header,.app-tabs,.np{display:none!important}body,html{margin:0;padding:0;background:#fff}}.ph-faint::placeholder{color:#e2e8f0!important}`}</style>
      <header className="app-header" style={{background:"#0f172a",color:"#fff",padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 16px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Ico d={I.box} size={20}/>
          <span style={{fontWeight:800,fontSize:15,letterSpacing:2}}>OLQ レンタル管理</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setTab("products")} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",color:"#86efac",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>🔄 製品同期</button>
          {isAdmin && <button onClick={()=>setShowImport(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fbbf24",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>📥 データ移行</button>}
          <span style={{fontSize:11,color:"#94a3b8"}}>製品{products.length}件 / 顧客{customers.length}社 / 案件{records.length}件</span>
          <span style={{fontSize:11,color:"#64748b"}}>{session.user.email}</span>
          <button onClick={()=>supabase.auth.signOut()} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#f87171",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>ログアウト</button>
        </div>
      </header>

      <div className="app-tabs" style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 18px",display:"flex"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",padding:"13px 16px",fontSize:13,fontWeight:600,cursor:"pointer",color:tab===t.id?"#2563eb":"#64748b",borderBottom:tab===t.id?"2px solid #2563eb":"2px solid transparent",display:"flex",alignItems:"center",gap:6,marginBottom:-1}}>
            <Ico d={t.icon} size={14} color={tab===t.id?"#2563eb":"#64748b"}/>{t.label}
          </button>
        ))}
      </div>

      {/* グローバル検索バー（案件・納品書・請求書タブのみ表示） */}
      {["records","delivery","invoice"].includes(tab)&&(
        <div style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0",padding:"8px 18px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative",flex:1,maxWidth:400}}>
            <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={14}/></div>
            <input value={globalQ} onChange={e=>setGlobalQ(e.target.value)}
              placeholder="顧客名・製品名・案件名で横断検索..."
              style={{...S.inp,paddingLeft:30,fontSize:13}}/>
          </div>
          {globalQ&&(
            <>
              <span style={{fontSize:12,color:"#64748b"}}>
                「{globalQ}」で絞り込み中
              </span>
              <button onClick={()=>setGlobalQ("")} style={{background:"none",border:"1px solid #e2e8f0",borderRadius:5,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#64748b"}}>✕ クリア</button>
            </>
          )}
        </div>
      )}

      <div style={{maxWidth:1280,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="records"   && <RecordsTab   records={records}   customers={customers} products={products} onSave={saveRec}  showToast={showToast} onGoToCustomer={(id)=>{setOpenCustomerId(id);setTab("customers");}} onAfterSubmit={()=>setTab("delivery")} invoiceData={invoiceData} globalQ={globalQ}/>}
        {tab==="delivery"  && <DeliveryTab  records={records}   customers={customers} groups={Object.values(invoiceGroups)} showToast={showToast} globalQ={globalQ}/>}
        {tab==="invoice"   && isAdmin && <InvoiceTab groups={Object.values(invoiceGroups)} customers={customers} onSaveCust={saveCust} invoiceData={invoiceData} onSaveInv={saveInv} showToast={showToast} globalQ={globalQ} records={records}/>}
        {tab==="invoice"   && !isAdmin && <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>請求書タブは管理者のみ閲覧できます。</div>}
        {tab==="customers" && <CustomersTab customers={customers} products={products} records={records} onSave={saveCust} showToast={showToast} presetCustomers={PRESET_CUSTOMERS} openCustomerId={openCustomerId} onOpenHandled={()=>setOpenCustomerId(null)}/>}
        {tab==="products"  && <ProductsTab  products={products}  customers={customers} onSave={saveProd} showToast={showToast} allProducts={ALL_PRODUCTS}/>}
      </div>
    </div>
  );
}

function RecordsTab({records,customers,products,onSave,showToast,onGoToCustomer,onAfterSubmit,invoiceData,globalQ}){
  // 締め済みの案件月セット
  const lockedMonths = new Set(
    Object.entries(invoiceData||{}).filter(([,d])=>d.status==="locked").map(([k])=>k.split("__")[1]).filter(Boolean)
  );
  const isRecordLocked = r => r.startDate && lockedMonths.has(r.startDate.slice(0,7));
  const [pwModal, setPwModal] = useState(null);
  const checkLock = (r, action) => {
    if (!isRecordLocked(r)) return true;
    setPwModal({month:r.startDate.slice(0,7), action, onOk: async (pw)=>{
      const ok = await verifyPw(pw);
      if(ok) return true;
      showToast("パスワードが違います",false);
      return false;
    }});
    return false;
  };
  // パスワード確認後のアクションを保持
  const [pendingAction, setPendingAction] = useState(null);
  const checkLockAsync = (r, action) => new Promise(resolve=>{
    if(!isRecordLocked(r)){resolve(true);return;}
    setPwModal({month:r.startDate.slice(0,7), action, resolve});
  });
  const emptyLine={productId:"",equipNo:"",unitPrice:"",quantity:"1",lineNote:"",subItems:[],equipmentName:"",expandRows:false};
  const emptyManualLine={productId:"",equipNo:"",unitPrice:"",quantity:"1",lineNote:"",subItems:[],equipmentName:"",expandRows:false,isManual:true,isFee:false,noBillingDiscount:false};
  const E={customerId:"",projectName:"",projectDetail:"",ecOrderNo:"",ordererName:"",ourStaff:"",billingType:"daily",months:"1",startDate:today(),endDate:today(),endDateOpen:false,notes:"",lines:[{...emptyLine}],noProjectName:false,issueReceipt:false,receiptDate:today(),paymentMethod:"credit",includeInsurance:false};
  const [form,setForm]=useState(E);
  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const [fil,setFil]=useState({q:"",cid:"",month:"",locked:""});
  const [expandedCust,setExpandedCust]=useState({}); // {custId: bool}
  const [expandedProj,setExpandedProj]=useState({}); // {custId_projName: bool}
  const [returnModal,setReturnModal]=useState(null); // {id, returnDate:"", billingEndDate:""}
  const [lineSearches,setLineSearches]=useState([""]);
  const [custSearch,setCustSearch]=useState(""); // 顧客絞り込み入力

  // 旧データ互換
  const getLines=r=>(r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];

  const cust = customers.find(c=>c.id===form.customerId);
  const days        = calcDays(form.startDate,form.endDate); // 実日数
  const billingDays = calcBillingDays(days);                  // 請求日数
  const billingQty  = form.billingType==="monthly" ? (Number(form.months)||1) : billingDays;
  // 製品ごとのnoBillingDiscountに応じてbillingQtyを切り替え
  const lineAmounts = (form.lines||[]).map(ln=>{
    const prod = products.find(p=>p.id===ln.productId);
    const noDisc = prod?.noBillingDiscount || ln.noBillingDiscount;
    // isFee（手数料）は日数掛けなし（台数×単価のみ）
    const qty = ln.isFee ? 1
              : form.billingType==="monthly" ? (Number(form.months)||1)
              : noDisc ? days : billingDays;
    return (Number(ln.unitPrice)||0)*(Number(ln.quantity)||0)*qty;
  });
  const totalAmount = lineAmounts.reduce((s,a)=>s+a,0);
  const insuranceAmount = form.includeInsurance ? Math.round(totalAmount * 0.1) : 0;
  const grandTotal = totalAmount + insuranceAmount;

  // expandRows=trueの時、subItemsを台数分に自動同期
  const syncSubItems=(ln)=>{
    if(!ln.expandRows) return ln;
    const n=Math.max(1,Number(ln.quantity)||1);
    const cur=ln.subItems||[];
    const synced=Array.from({length:n},(_,i)=>cur[i]||{no:"",note:""});
    return {...ln,subItems:synced};
  };

  const setLine=(idx,patch)=>{
    setForm(f=>{
      const lines=[...f.lines];
      let updated={...lines[idx],...patch};
      if(patch.productId){
        const p=products.find(x=>x.id===patch.productId);
        const c=customers.find(x=>x.id===f.customerId);
        updated.unitPrice=String(resolvePrice(p,c));
        updated.equipmentName=p?.fullName||"";
        updated.noBillingDiscount=!!p?.noBillingDiscount;
      }
      // expandRows切替 or quantity変更時にsubItemsを同期
      if(patch.expandRows!==undefined||patch.quantity!==undefined){
        updated=syncSubItems(updated);
      }
      lines[idx]=updated;
      return{...f,lines};
    });
  };
  const addLine=()=>{setForm(f=>({...f,lines:[...(f.lines||[]),{...emptyLine}]}));setLineSearches(s=>[...s,""]);}; 
  const addManualLine=()=>{setForm(f=>({...f,lines:[...(f.lines||[]),{...emptyManualLine}]}));setLineSearches(s=>[...s,""]);};
  const removeLine=idx=>{if((form.lines||[]).length<=1)return;setForm(f=>({...f,lines:f.lines.filter((_,i)=>i!==idx)}));setLineSearches(s=>s.filter((_,i)=>i!==idx));};
  const setLineProdQ=(idx,v)=>setLineSearches(s=>{const n=[...s];n[idx]=v;return n;});
  const addSub=(li)=>setLine(li,{subItems:[...(form.lines[li].subItems||[]),{no:"",note:""}]});
  const removeSub=(li,si)=>setLine(li,{subItems:form.lines[li].subItems.filter((_,j)=>j!==si)});
  const setSub=(li,si,patch)=>{const subs=[...(form.lines[li].subItems||[])];subs[si]={...subs[si],...patch};setLine(li,{subItems:subs});};

  const submit=async()=>{
    if(!form.customerId){showToast("顧客は必須です",false);return;}
    const validLines=(form.lines||[]).filter(ln=>ln.isManual?(!!ln.equipmentName&&!!ln.unitPrice):(ln.productId&&ln.unitPrice));
    if(!validLines.length){showToast("製品を1つ以上追加してください",false);return;}
    const lines=validLines.map(ln=>{
      const p=products.find(x=>x.id===ln.productId);
      const noDisc=p?.noBillingDiscount||ln.noBillingDiscount;
      return{...ln,unitPrice:Number(ln.unitPrice),quantity:Number(ln.quantity)||1,
        equipmentName:ln.isManual?ln.equipmentName:(p?.fullName||ln.equipmentName||""),
        noBillingDiscount:ln.isManual?!!ln.noBillingDiscount:!!noDisc,
        isFee:!!ln.isFee,isManual:!!ln.isManual};
    });
    const rec={customerId:form.customerId,projectName:form.projectName,projectDetail:form.projectDetail,ecOrderNo:form.ecOrderNo||"",ordererName:form.ordererName,ourStaff:form.ourStaff,
      billingType:form.billingType,months:form.billingType==="monthly"?(Number(form.months)||1):0,
      days:form.billingType==="monthly"?0:days,billingDays:form.billingType==="monthly"?0:billingDays,startDate:form.startDate,endDate:form.endDateOpen?"":form.endDate,endDateOpen:form.billingType==="monthly"&&!!form.endDateOpen,notes:form.notes,
      issueReceipt:!!form.issueReceipt,receiptDate:form.issueReceipt?(form.receiptDate||""):"",paymentMethod:form.issueReceipt?(form.paymentMethod||"credit"):"",
      includeInsurance:!!form.includeInsurance,
      lines,amount:totalAmount,insuranceAmount,
      equipmentName:lines.map(l=>l.equipmentName).join(", "),unitPrice:lines[0]?.unitPrice||0,quantity:lines.reduce((s,l)=>s+(Number(l.quantity)||0),0),
      productId:lines[0]?.productId||"",
      id:editId||uid(),updatedAt:Date.now(),createdAt:editId?records.find(r=>r.id===editId)?.createdAt:Date.now()};
    if(!editId && !rec.deliveryNo) { rec.deliveryNo = await nextDeliveryNo(); }
    await onSave(editId?records.map(r=>r.id===editId?rec:r):[rec,...records]);
    const wasNew=!editId;
    showToast(editId?"更新しました":"登録しました");setForm(E);setEditId(null);setOpen(false);setLineSearches([""]);
    if(wasNew&&onAfterSubmit) onAfterSubmit();
  };

  const mnths=[...new Set(records.map(r=>r.startDate?.slice(0,7)))].filter(Boolean).sort().reverse();
  const filtered=records.filter(r=>{
    const q=fil.q.toLowerCase(),c=customers.find(x=>x.id===r.customerId);
    const rLns2=getLines(r);
    const gq=(globalQ||"").toLowerCase();
    const matchGQ=!gq||c?.name?.toLowerCase().includes(gq)||r.projectName?.toLowerCase().includes(gq)
      ||rLns2.some(ln=>(ln.equipmentName||"").toLowerCase().includes(gq));
    const matchQ=!q||c?.name?.toLowerCase().includes(q)||r.projectName?.toLowerCase().includes(q)
      ||rLns2.some(ln=>(ln.equipmentName||"").toLowerCase().includes(q))
      ||(r.deliveryNo||"").toLowerCase().includes(q);
    const matchLocked=!fil.locked||(fil.locked==="locked"?isRecordLocked(r):!isRecordLocked(r));
    return matchQ&&matchGQ&&(!fil.cid||r.customerId===fil.cid)&&(!fil.month||r.startDate?.startsWith(fil.month))&&matchLocked;
  });

  return(
    <div>

      {open&&(
        <div style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"案件を編集":"新規案件登録"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setLineSearches([""]);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客 *</label>
              <SearchableSelect
                value={form.customerId}
                onChange={v=>setForm(f=>({...f,customerId:v,projectName:"",projectDetail:""}))}
                options={customers.map(c=>{const k=Number(c.discountRate)||0;return {value:c.id,label:c.name+(k>0&&k<10?` (${k}掛)`:"")};})} 
                placeholder="顧客を選択..."
              />
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                <label style={{...S.lbl,margin:0}}>案件名（請求書の分類）</label>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,cursor:"pointer",userSelect:"none",color:form.noProjectName?"#ef4444":"#64748b"}}>
                  <input
                    type="checkbox"
                    checked={!!form.noProjectName}
                    onChange={e=>setForm(f=>({...f,noProjectName:e.target.checked,projectName:""}))}
                    style={{cursor:"pointer"}}
                  />
                  案件名なし
                </label>
                {form.customerId&&(
                  <button
                    type="button"
                    onClick={()=>onGoToCustomer&&onGoToCustomer(form.customerId)}
                    style={{...S.ib("#0369a1"),fontSize:11,padding:"3px 8px"}}
                  >
                    ＋ 顧客管理で案件名を追加
                  </button>
                )}
              </div>
              {!form.noProjectName&&(()=>{
                const masterProjects = customers.find(c=>c.id===form.customerId)?.projects||[];
                if(!form.customerId){
                  return <div style={{...S.inp,color:"#94a3b8",display:"flex",alignItems:"center"}}>先に顧客を選択してください</div>;
                }
                if(masterProjects.length===0){
                  return <div style={{...S.inp,color:"#f59e0b",display:"flex",alignItems:"center",fontSize:12}}>⚠ 上の「顧客管理で案件名を追加」から登録してください</div>;
                }
                return(
                  <SearchableSelect
                    value={form.projectName}
                    onChange={v=>setForm(f=>({...f,projectName:v}))}
                    options={masterProjects.map(p=>({value:p,label:p}))}
                    placeholder="案件名を選択..."
                  />
                );
              })()}
              {form.noProjectName&&(
                <div style={{...S.inp,color:"#94a3b8",display:"flex",alignItems:"center",fontSize:12,background:"#f8fafc"}}>案件名なしで登録します</div>
              )}
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>案件詳細（案件名の隣に表示）</label><input className="ph-faint" value={form.projectDetail} onChange={e=>setForm(f=>({...f,projectDetail:e.target.value}))} style={S.inp} placeholder="例: 第1話 スタジオ収録"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>ECサイト注文番号　<span style={{fontSize:10,fontWeight:400,color:"#94a3b8"}}>（ECサイト経由の場合のみ）</span></label><input value={form.ecOrderNo||""} onChange={e=>setForm(f=>({...f,ecOrderNo:e.target.value}))} style={S.inp} placeholder="例: 0000-0000"/></div>
            <div><label style={S.lbl}>ご発注者名（先方担当）</label><input value={form.ordererName} onChange={e=>setForm(f=>({...f,ordererName:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>弊社担当（自社）</label><input value={form.ourStaff} onChange={e=>setForm(f=>({...f,ourStaff:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>開始日</label><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>終了日</label>
              {form.billingType==="monthly"&&(
                <label style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:12,cursor:"pointer",userSelect:"none",color:"#7c3aed"}}>
                  <input type="checkbox" checked={!!form.endDateOpen} onChange={e=>setForm(f=>({...f,endDateOpen:e.target.checked}))} style={{cursor:"pointer"}}/>
                  終了未定（毎月自動計上）
                </label>
              )}
              {!form.endDateOpen&&<input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={S.inp}/>}
              {form.endDateOpen&&<div style={{...S.inp,background:"#faf5ff",color:"#7c3aed",fontSize:12,display:"flex",alignItems:"center"}}>終了未定</div>}
            </div>
            <div><label style={S.lbl}>課金区分</label>
              <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>{[{k:"daily",l:"日極"},{k:"monthly",l:"月極"}].map(t=>(<button key={t.k} type="button" onClick={()=>setForm(f=>({...f,billingType:t.k}))} style={{flex:1,background:form.billingType===t.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"6px 0",fontSize:12,fontWeight:form.billingType===t.k?700:500,color:form.billingType===t.k?(t.k==="daily"?"#2563eb":"#9333ea"):"#94a3b8",cursor:"pointer",boxShadow:form.billingType===t.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>))}</div></div>
            {form.billingType==="monthly"&&<div><label style={S.lbl}>月数</label><input type="number" min={1} value={form.months} onChange={e=>setForm(f=>({...f,months:e.target.value}))} style={S.inp}/></div>}
          </div>
          {/* 機材リスト */}
          <div style={{marginTop:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700}}>機材リスト（{form.lines?.length||0}品目）</div>
              <div style={{display:"flex",gap:6}}>
                <button type="button" onClick={addLine} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>機材を追加</button>
                <button type="button" onClick={addManualLine} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>手入力で追加</button>
              </div>
            </div>
            {(form.lines||[]).map((ln,li)=>{
              const lProd=products.find(p=>p.id===ln.productId);
              const lq=lineSearches[li]||"";
              const lfp=lq.length>=1?products.filter(p=>p.fullName.toLowerCase().includes(lq.toLowerCase())):[];
              const qty=Number(ln.quantity)||1;
              const isManual=!!ln.isManual;
              return(
                <div key={li} style={{background:isManual?"#f0f9ff":"#f8fafc",border:`1px solid ${isManual?"#bae6fd":"#e2e8f0"}`,borderRadius:9,padding:"12px 14px",marginBottom:8}}>
                  {/* ヘッダー */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:isManual?"#0369a1":"#475569"}}>
                      #{li+1}{isManual?" ✏️手入力":""}{ln.equipmentName?` — ${ln.equipmentName}`:""}
                    </span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {isManual&&(
                        <>
                          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#92400e",cursor:"pointer",userSelect:"none",background:"#fff7ed",borderRadius:4,padding:"2px 7px",border:"1px solid #fed7aa"}}>
                            <input type="checkbox" checked={!!ln.isFee} onChange={e=>setLine(li,{isFee:e.target.checked,noBillingDiscount:e.target.checked?false:ln.noBillingDiscount})} style={{cursor:"pointer"}}/>
                            手数料（日数なし）
                          </label>
                          {!ln.isFee&&(
                            <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#475569",cursor:"pointer",userSelect:"none"}}>
                              <input type="checkbox" checked={!!ln.noBillingDiscount} onChange={e=>setLine(li,{noBillingDiscount:e.target.checked})} style={{cursor:"pointer"}}/>
                              日数値引きなし
                            </label>
                          )}
                        </>
                      )}
                      {!isManual&&qty>=2&&(
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#475569",cursor:"pointer",userSelect:"none"}}>
                          <input type="checkbox" checked={!!ln.expandRows} onChange={e=>setLine(li,{expandRows:e.target.checked})} style={{cursor:"pointer"}}/>
                          行を増やす（各台個別入力）
                        </label>
                      )}
                      {form.lines.length>1&&<button type="button" onClick={()=>removeLine(li)} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.trash} size={14} color="#ef4444"/></button>}
                    </div>
                  </div>

                  {/* 製品・単価・台数 */}
                  <div style={{display:"grid",gridTemplateColumns:"2fr 90px 60px",gap:6,alignItems:"end",marginBottom:6}}>
                    <div>
                      <label style={{fontSize:10,color:"#64748b",fontWeight:600}}>{isManual?"製品名（手入力） *":"製品 *"}</label>
                      {isManual
                        ? <input value={ln.equipmentName} onChange={e=>setLine(li,{equipmentName:e.target.value})} placeholder="例: Sony FX3（他社借り）" style={{...S.inp,fontSize:11,padding:"6px 8px"}}/>
                        : <>
                            <div style={{position:"relative"}}><div style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={11}/></div>
                              <input value={lq} onChange={e=>setLineProdQ(li,e.target.value)} placeholder="検索..." style={{...S.inp,paddingLeft:24,fontSize:11,padding:"6px 8px 6px 24px"}}/></div>
                            {lq.length>=1&&<select value={ln.productId} onChange={e=>{setLine(li,{productId:e.target.value});setLineProdQ(li,"");}} style={{...S.inp,fontSize:11,marginTop:2}} size={Math.min(4,lfp.length+1)}><option value="">{lfp.length}件</option>{lfp.map(p=><option key={p.id} value={p.id}>{p.fullName} {fmt(p.priceEx)}</option>)}</select>}
                            {ln.productId&&!lq&&<div style={{fontSize:10,color:"#16a34a",marginTop:2}}>{lProd?.fullName||ln.equipmentName}</div>}
                          </>
                      }
                    </div>
                    <div>
                      <label style={{fontSize:10,color:"#64748b",fontWeight:600}}>
                        単価{ln.isFee?"（固定）":form.billingType==="monthly"?"/月":"/日"}
                      </label>
                      <input type="number" value={ln.unitPrice} onChange={e=>setLine(li,{unitPrice:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/>
                    </div>
                    <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>台数</label><input type="number" min={1} value={ln.quantity} onChange={e=>setLine(li,{quantity:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/></div>
                  </div>

                  {/* 機材No.と行備考 */}
                  {(!ln.expandRows||isManual)&&(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>機材No.</label><input value={ln.equipNo} onChange={e=>setLine(li,{equipNo:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/></div>
                      <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>行備考</label><input value={ln.lineNote||""} onChange={e=>setLine(li,{lineNote:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}} placeholder="バッテリー数など"/></div>
                    </div>
                  )}

                  {/* 行を増やす場合（通常ラインのみ） */}
                  {!isManual&&ln.expandRows&&qty>=2&&(
                    <div style={{marginTop:4}}>
                      <div style={{fontSize:10,color:"#0369a1",fontWeight:600,marginBottom:4}}>各台の情報（{qty}台分）</div>
                      {(ln.subItems||[]).slice(0,qty).map((si,si2)=>(
                        <div key={si2} style={{display:"grid",gridTemplateColumns:"22px 1fr 1fr",gap:4,marginBottom:4,alignItems:"center",background:si2===0?"#eff6ff":"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 8px"}}>
                          <span style={{fontSize:10,fontWeight:700,color:si2===0?"#2563eb":"#94a3b8",textAlign:"center"}}>{si2===0?qty+"台":"―"}</span>
                          <input value={si.no} onChange={e=>setSub(li,si2,{no:e.target.value})} style={{...S.inp,fontSize:11,padding:"4px 6px"}} placeholder={`機材No.（${si2+1}台目）`}/>
                          <input value={si.note||""} onChange={e=>setSub(li,si2,{note:e.target.value})} style={{...S.inp,fontSize:11,padding:"4px 6px"}} placeholder="行備考（バッテリー数など）"/>
                        </div>
                      ))}
                    </div>
                  )}

                  {lineAmounts[li]>0&&<div style={{fontSize:11,color:"#16a34a",fontWeight:600,marginTop:6}}>小計: {fmt(lineAmounts[li])}{ln.isFee&&<span style={{color:"#92400e",marginLeft:6,fontSize:10}}>（日数掛けなし）</span>}</div>}
                </div>
              );
            })}
          </div>
          {/* 合計 */}
          <div style={{marginTop:14,background:form.billingType==="monthly"?"#faf5ff":"#eff6ff",borderRadius:9,padding:"12px 18px",display:"flex",gap:24,flexWrap:"wrap",fontSize:13,alignItems:"center"}}>
            {form.billingType==="monthly"
              ?<span><span style={{color:"#64748b"}}>月数: </span><strong style={{color:"#9333ea",fontSize:17}}>{(form.months||1)}ヶ月</strong></span>
              :<span style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{color:"#64748b"}}>実日数:</span>
                <strong style={{color:"#94a3b8",fontSize:15}}>{days}日</strong>
                <span style={{color:"#94a3b8",fontSize:12}}>→</span>
                <span style={{color:"#64748b"}}>請求日数:</span>
                <strong style={{color:"#2563eb",fontSize:17}}>{billingDays}日</strong>
                {days!==billingDays&&<span style={{fontSize:10,color:"#f59e0b",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:4,padding:"1px 6px"}}>割引適用</span>}
              </span>
            }
            <span><span style={{color:"#64748b"}}>機材合計(税抜): </span><strong style={{color:"#16a34a",fontSize:17}}>{fmt(totalAmount)}</strong></span>
            {form.includeInsurance&&<span style={{fontSize:12,color:"#b45309"}}>補償料: <strong>{fmt(insuranceAmount)}</strong></span>}
            <span><span style={{color:"#64748b"}}>合計(税込): </span><strong style={{color:"#9333ea",fontSize:17}}>{fmt(taxIn(grandTotal))}</strong></span>
            <span style={{fontSize:11,color:"#94a3b8"}}>{form.lines?.length||0}品目</span>
          </div>
          {/* 補償料チェック */}
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:"10px 14px"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:700,color:"#92400e",userSelect:"none"}}>
              <input type="checkbox" checked={!!form.includeInsurance} onChange={e=>setForm(f=>({...f,includeInsurance:e.target.checked}))} style={{cursor:"pointer"}}/>
              補償料を計上する（機材合計の10%）
            </label>
            {form.includeInsurance&&<span style={{fontSize:12,color:"#92400e"}}>= {fmt(insuranceAmount)}（税抜）</span>}
          </div>
          {/* 領収証発行（補償料の下） */}
          <div style={{marginTop:10,background:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:700,color:"#713f12",userSelect:"none"}}>
              <input type="checkbox" checked={!!form.issueReceipt} onChange={e=>setForm(f=>({...f,issueReceipt:e.target.checked}))} style={{cursor:"pointer"}}/>
              領収証を発行する（納品書と同時に出力）
            </label>
            {form.issueReceipt&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px",marginTop:10}}>
                <div>
                  <label style={S.lbl}>領収日</label>
                  <input type="date" value={form.receiptDate} onChange={e=>setForm(f=>({...f,receiptDate:e.target.value}))} style={S.inp}/>
                </div>
                <div>
                  <label style={S.lbl}>支払方法</label>
                  <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                    {[{k:"credit",l:"💳 クレジット"},{k:"cash",l:"💴 現金"}].map(t=>(
                      <button key={t.k} type="button" onClick={()=>setForm(f=>({...f,paymentMethod:t.k}))} style={{flex:1,background:form.paymentMethod===t.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"6px 0",fontSize:12,fontWeight:form.paymentMethod===t.k?700:500,color:form.paymentMethod===t.k?"#713f12":"#94a3b8",cursor:"pointer",boxShadow:form.paymentMethod===t.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{marginTop:14}}>
            <label style={S.lbl}>備考（全体）</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...S.inp,resize:"vertical"}} rows={5} placeholder="案件全体に関する備考（改行可）"/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>{editId?"更新":"登録"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setLineSearches([""]);}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      {/* パスワード確認モーダル */}
      {pwModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>{pwModal.resolve&&pwModal.resolve(false);setPwModal(null);}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔒 締め済み月の操作</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              {pwModal.month} は締め済みです。<br/>{pwModal.action}するにはパスワードを入力してください。
            </div>
            <PwInput onOk={async pw=>{
              const ok = await verifyPw(pw);
              if(ok){pwModal.resolve&&pwModal.resolve(true);setPwModal(null);}
              else{showToast("パスワードが違います",false);}
            }} onCancel={()=>{pwModal.resolve&&pwModal.resolve(false);setPwModal(null);}}/>
          </div>
        </div>
      )}
      {/* 戻り[終了]モーダル */}
      {returnModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:360,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>📦 戻り[終了]の設定</div>
            <div style={{marginBottom:12}}>
              <label style={S.lbl}>返却日（機材が戻った日）</label>
              <input type="date" value={returnModal.returnDate}
                onChange={e=>setReturnModal(p=>({...p,returnDate:e.target.value}))}
                style={S.inp}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.lbl}>計上終了日（請求に含める最終日）</label>
              <input type="date" value={returnModal.billingEndDate}
                onChange={e=>setReturnModal(p=>({...p,billingEndDate:e.target.value}))}
                style={S.inp}/>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>※返却日と異なる場合があります（例：前日まで計上など）</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={async()=>{
                if(!returnModal.billingEndDate){showToast("計上終了日を入力してください",false);return;}
                await onSave(records.map(x=>x.id===returnModal.id?{...x,returnDate:returnModal.billingEndDate,actualReturnDate:returnModal.returnDate}:x));
                showToast("計上終了日: "+returnModal.billingEndDate+" で設定しました");
                setReturnModal(null);
              }} style={S.btn("#7c3aed",true)}>設定する</button>
              <button onClick={()=>setReturnModal(null)} style={S.btn("#94a3b8")}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
            <div style={{flex:1,minWidth:200,position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={fil.q} onChange={e=>setFil(f=>({...f,q:e.target.value}))} placeholder="顧客名・製品名・案件名で検索..." style={{...S.inp,paddingLeft:28}}/>
            </div>
            <select value={fil.cid} onChange={e=>setFil(f=>({...f,cid:e.target.value}))} style={{...S.inp,width:160}}><option value="">全顧客</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={fil.month} onChange={e=>setFil(f=>({...f,month:e.target.value}))} style={{...S.inp,width:120}}><option value="">全期間</option>{mnths.map(m=><option key={m}>{m}</option>)}</select>
            <select value={fil.locked||""} onChange={e=>setFil(f=>({...f,locked:e.target.value}))} style={{...S.inp,width:110}}>
              <option value="">全ステータス</option>
              <option value="locked">🔒 締め済み</option>
              <option value="open">🔓 未締め</option>
            </select>
            <button onClick={()=>{setForm(E);setEditId(null);setLineSearches([""]);setOpen(true);}} style={S.btn("#0f172a")}><Ico d={I.plus} size={15}/>新規登録</button>
          </div>
          <div style={{fontSize:11,color:"#64748b"}}>
            {filtered.length}件表示
            {fil.q&&<span style={{marginLeft:8,background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 6px"}}>「{fil.q}」</span>}
            {(fil.q||fil.cid||fil.month||fil.locked)&&<button onClick={()=>setFil({q:"",cid:"",month:"",locked:""})} style={{marginLeft:8,background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:11}}>✕ クリア</button>}
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          {filtered.length===0
            ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>案件がありません。「新規登録」から追加してください。</div>
            :(()=>{
              const filteredMonthly = filtered.filter(r=>r.billingType==="monthly");
              const filteredDaily   = filtered.filter(r=>r.billingType!=="monthly");
              const renderGroup = (recs, sectionLabel, sectionColor) => {
                if(recs.length===0) return null;
                const custGroups={};
                recs.forEach(r=>{
                const cid=r.customerId||"__none__";
                if(!custGroups[cid]) custGroups[cid]={c:customers.find(x=>x.id===cid),recs:[]};
                custGroups[cid].recs.push(r);
              });
              return Object.entries(custGroups).map(([cid,{c,recs}])=>{
                const custOpen=!!expandedCust[cid]; // default open
                const custTotal=recs.reduce((s,r)=>s+(r.amount||0),0);
                const hasLocked=recs.some(r=>isRecordLocked(r));
                // 案件名ごとにグループ化
                const projGroups={};
                recs.forEach(r=>{
                  const pk=(r.projectName||"―");
                  if(!projGroups[pk]) projGroups[pk]=[];
                  projGroups[pk].push(r);
                });
                return(
                  <div key={cid} style={{borderBottom:"1px solid #e2e8f0"}}>
                    {/* 顧客ヘッダー行 */}
                    <div onClick={()=>setExpandedCust(p=>({...p,[cid]:!custOpen}))}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#f1f5f9",cursor:"pointer",userSelect:"none"}}>
                      <span style={{fontSize:13,color:"#64748b",minWidth:14}}>{custOpen?"▼":"▶"}</span>
                      <span style={{fontWeight:700,fontSize:13,flex:1}}>{c?.name||"顧客不明"}</span>
                      {hasLocked&&<span style={{fontSize:10,color:"#15803d",background:"#dcfce7",borderRadius:4,padding:"1px 6px"}}>🔒 締め含む</span>}
                      <span style={{fontSize:11,color:"#64748b"}}>{recs.length}件</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>{fmt(custTotal)}</span>
                    </div>
                    {custOpen&&Object.entries(projGroups).map(([projName,pRecs])=>{
                      const pk=cid+"__"+projName;
                      const projOpen=!!expandedProj[pk]; // default open
                      const projTotal=pRecs.reduce((s,r)=>s+(r.amount||0),0);
                      return(
                        <div key={pk}>
                          {/* 案件名ヘッダー行 */}
                          <div onClick={()=>setExpandedProj(p=>({...p,[pk]:!projOpen}))}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px 8px 36px",background:"#f8fafc",cursor:"pointer",userSelect:"none",borderTop:"1px solid #e2e8f0"}}>
                            <span style={{fontSize:12,color:"#94a3b8",minWidth:12}}>{projOpen?"▼":"▶"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"#475569",flex:1}}>{projName}</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{pRecs.length}件</span>
                            <span style={{fontSize:11,fontWeight:600,color:"#16a34a"}}>{fmt(projTotal)}</span>
                          </div>
                          {/* 明細行 */}
                          {projOpen&&(
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <tbody>
                                {pRecs.map(r=>{
                                  const isM=r.billingType==="monthly";
                                  const rL=getLines(r);
                                  const locked=isRecordLocked(r);
                                  return(
                                    <tr key={r.id} style={{borderTop:"1px solid #f1f5f9",background:locked?"#f0fdf4":"#fff"}}>
                                      <td style={{padding:"8px 16px 8px 56px",color:"#64748b",fontSize:11,whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}{r.deliveryNo&&<span style={{marginLeft:6,fontSize:10,color:"#94a3b8",background:"#f1f5f9",borderRadius:4,padding:"1px 5px"}}>No.{r.deliveryNo}</span>}</td>
                                      <td style={{padding:"8px 12px"}}>
                                        {rL.length===1
                                          ?<span>{rL[0].equipmentName||r.equipmentName} <span style={{color:"#94a3b8"}}>×{rL[0].quantity||r.quantity}</span></span>
                                          :<div>{rL.map((ln,j)=><div key={j} style={{fontSize:11}}>{ln.equipmentName} <span style={{color:"#94a3b8"}}>×{ln.quantity}</span></div>)}</div>}
                                        {r.projectDetail&&<div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{r.projectDetail}</div>}
                                      </td>
                                      <td style={{padding:"8px 12px",textAlign:"center",whiteSpace:"nowrap"}}>
                                        {isM?<span style={{background:"#faf5ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>月極</span>
                                            :<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>日極</span>}
                                      </td>
                                      <td style={{padding:"8px 8px",textAlign:"center",fontWeight:600,color:isM?"#7c3aed":"#2563eb",whiteSpace:"nowrap"}}>{isM?(r.months||1)+"ヶ月":(r.billingDays||r.days)+"日"}</td>
                                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a",whiteSpace:"nowrap"}}>{fmt(r.amount)}</td>
                                      <td style={{padding:"8px 12px",whiteSpace:"nowrap",textAlign:"right"}}>
                                        {locked&&<span style={{fontSize:10,marginRight:4,color:"#15803d"}}>🔒</span>}
                                        {(r.endDateOpen||(!r.endDate&&r.billingType==="monthly"))&&!r.returnDate&&(
                                          <button onClick={e=>{e.stopPropagation();setReturnModal({id:r.id,returnDate:today(),billingEndDate:today()});}}
                                            style={{...S.ib("#7c3aed"),marginRight:4,fontSize:10}}>📦 戻り[終了]</button>
                                        )}
                                        {r.returnDate&&<span style={{fontSize:10,color:"#7c3aed",marginRight:4,whiteSpace:"nowrap"}}>計上終了:{r.returnDate}</span>}
                                        <button onClick={async e=>{e.stopPropagation();if(!await checkLockAsync(r,"編集"))return;const rLns=getLines(r);setForm({customerId:r.customerId,projectName:r.projectName||"",projectDetail:r.projectDetail||"",ecOrderNo:r.ecOrderNo||"",ordererName:r.ordererName||"",ourStaff:r.ourStaff||"",billingType:r.billingType||"daily",months:String(r.months||1),startDate:r.startDate,endDate:r.endDate||today(),endDateOpen:!!r.endDateOpen,notes:r.notes||"",issueReceipt:!!r.issueReceipt,receiptDate:r.receiptDate||today(),paymentMethod:r.paymentMethod||"credit",includeInsurance:!!r.includeInsurance,lines:rLns.map(ln=>({productId:ln.productId||"",equipNo:ln.equipNo||"",unitPrice:String(ln.unitPrice||""),quantity:String(ln.quantity||1),lineNote:ln.lineNote||"",subItems:ln.subItems||[],equipmentName:ln.equipmentName||""}))});setLineSearches(rLns.map(()=>""));setEditId(r.id);setOpen(true);}} style={{...S.ib(locked?"#64748b":"#92400e"),marginRight:4}}><Ico d={I.edit} size={12}/></button>
                                        <button onClick={async e=>{e.stopPropagation();if(!await checkLockAsync(r,"削除"))return;await onSave(records.filter(x=>x.id!==r.id));showToast("削除しました");}} style={S.ib(locked?"#64748b":"#991b1b")}><Ico d={I.trash} size={12}/></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
              };
              return(<>
                {filteredMonthly.length>0&&(
                  <div>
                    <div style={{padding:"8px 16px",background:"#f5f3ff",borderBottom:"2px solid #ede9fe",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>📅 月極案件</span>
                      <span style={{fontSize:11,color:"#a78bfa"}}>{filteredMonthly.length}件</span>
                    </div>
                    {renderGroup(filteredMonthly,"月極","#f5f3ff")}
                  </div>
                )}
                {filteredDaily.length>0&&(
                  <div>
                    <div style={{padding:"8px 16px",background:"#eff6ff",borderBottom:"2px solid #dbeafe",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#2563eb"}}>📋 日極案件</span>
                      <span style={{fontSize:11,color:"#60a5fa"}}>{filteredDaily.length}件</span>
                    </div>
                    {renderGroup(filteredDaily,"日極","#eff6ff")}
                  </div>
                )}
              </>);
            })()}
          {filtered.length>0&&(
            <div style={{background:"#eff6ff",padding:"9px 16px",display:"flex",justifyContent:"flex-end",gap:16,fontSize:12,fontWeight:700,borderTop:"2px solid #e2e8f0"}}>
              <span style={{color:"#64748b"}}>合計（税抜）</span>
              <span style={{color:"#16a34a",fontSize:14}}>{fmt(filtered.reduce((s,r)=>s+r.amount,0))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function genReceiptNo(r, idx) {
  const d = r.receiptDate ? new Date(r.receiptDate) : (r.startDate ? new Date(r.startDate) : new Date());
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const seq = String(idx+1).padStart(2,"0");
  return `${yy}${mm}${dd}${seq}`;
}
async function nextInvoiceNo(month) {
  const { data, error } = await supabase.rpc('next_invoice_no');
  if (error) { console.error('nextInvoiceNo error', error); return `${month}-ERR`; }
  return `${month}-${String(data).padStart(3,'0')}`;
}

async function nextDeliveryNo() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const { data, error } = await supabase.rpc('next_delivery_no');
  if (error) { console.error('nextDeliveryNo error', error); return 'ERR'; }
  return `${yy}-${String(data).padStart(5,'0')}`;
}

function genDeliveryNo(r, idx) {
  if(r.deliveryNo) return r.deliveryNo;
  const d = r.createdAt ? new Date(r.createdAt) : (r.startDate ? new Date(r.startDate) : new Date());
  const yy = String(d.getFullYear()).slice(-2);
  const mons = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = mons[d.getMonth()];
  const dd = String(d.getDate()).padStart(2,"0");
  const seq = String(idx+1).padStart(2,"0");
  return `${yy}${mon}${dd}${seq}`;
}

// 納品書（お客様用）— 1ページ
function DeliveryCustomer({r, g, no, forPrint, showPrice}){
  const fs = forPrint ? 1 : 0.78;
  const bdr = "1px solid #555";
  const ROWS = 20;
  return(
    <div style={{padding:`${28*fs}px ${32*fs}px`,color:"#111",fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4*fs}}>
        <div style={{fontSize:22*fs,fontWeight:800,letterSpacing:8}}>納 品 書</div>
        <div style={{textAlign:"right",fontSize:10.5*fs,lineHeight:2}}>
          <div>納品書No.　<strong>{no}</strong></div>
          <div>日付　{fmtD(r.startDate)}</div>
        </div>
      </div>
      {/* 宛名 + 自社 */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:12*fs,marginBottom:6*fs,gap:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15*fs,fontWeight:700,borderBottom:"2px solid #111",paddingBottom:3,display:"inline-block"}}>
            {g.customer?.invoiceName||g.customerName}　<span style={{fontWeight:400}}>{ (r.ordererName||g.customer?.contact) ? "御中" : "様"}</span>
          </div>
          {(r.projectName||g.projectName)&&<div style={{fontSize:12*fs,marginTop:4}}>『{r.projectName||g.projectName}{r.projectDetail&&<span style={{fontWeight:400,fontSize:11*fs}}>　{r.projectDetail}</span>}』</div>}
          {r.ecOrderNo&&<div style={{fontSize:10*fs,marginTop:2}}>EC注文番号：{r.ecOrderNo}</div>}
          {(r.ordererName||g.customer?.contact)&&<div style={{fontSize:12*fs,marginTop:3}}>{r.ordererName||g.customer?.contact}　様</div>}
        </div>
        <div style={{textAlign:"right",fontSize:9.5*fs,lineHeight:1.7,flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:11*fs}}>オルク株式会社</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><span>担当</span><strong>{r.ourStaff||"―"}</strong></div>
          <div>〒105-0004</div>
          <div>東京都港区新橋6-10-2</div>
          <div>第二新洋ビル 1F</div>
          <div>TEL: 03-5777-1100</div>
          <div>FAX: 03-5777-1101</div>
        </div>
      </div>
      <div style={{fontSize:10*fs,color:"#444",marginBottom:10*fs}}>毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</div>
      {/* テーブル（showPriceで分岐） */}
      {(()=>{
        const lines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,equipNo:r.equipNo,unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[]}];
        let rowIdx=0;
        const dataRows=[];
        lines.forEach((ln,li)=>{
          rowIdx++;
          if(showPrice){
            dataRows.push(<tr key={`m${li}`}><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{rowIdx}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`}}>{ln.equipmentName}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(ln.unitPrice)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.endDate)}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,fontSize:9*fs}}>{r.billingType==="monthly"?"月極"+(ln.lineNote?" "+ln.lineNote:""):(ln.lineNote||"")}</td></tr>);
            (ln.subItems||[]).forEach((si,si2)=>{rowIdx++;dataRows.push(<tr key={`s${li}_${si2}`}><td style={{border:bdr,padding:`${2*fs}px`,color:"#aaa"}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px ${2*fs}px ${14*fs}px`,fontSize:9*fs,color:"#555"}}>└ No.{si.no}</td><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px`,fontSize:8.5*fs,color:"#666"}}>{si.note||""}</td></tr>);});
          } else {
            dataRows.push(<tr key={`m${li}`}><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{rowIdx}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`}}>{ln.equipmentName}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.endDate)}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,fontSize:9*fs}}>{r.billingType==="monthly"?"月極"+(ln.lineNote?" "+ln.lineNote:""):(ln.lineNote||"")}</td></tr>);
            (ln.subItems||[]).forEach((si,si2)=>{rowIdx++;dataRows.push(<tr key={`s${li}_${si2}`}><td style={{border:bdr,padding:`${2*fs}px`,color:"#aaa"}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px ${2*fs}px ${16*fs}px`,fontSize:9*fs,color:"#555"}}>└ No.{si.no}</td><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px`,fontSize:8.5*fs,color:"#666"}}>{si.note||""}</td></tr>);});
          }
        });
        const emptyCount=Math.max(0,ROWS-rowIdx);
        const cols = showPrice
          ? [{l:"No.",w:28},{l:"機材名"},{l:"単価",w:60},{l:"数量",w:40},{l:"開始日",w:72},{l:"終了日",w:72},{l:"備考"}]
          : [{l:"No.",w:28},{l:"機材名"},{l:"数量",w:40},{l:"開始日",w:72},{l:"終了日",w:72},{l:"備考"}];
        const emptyCols = showPrice ? [28,0,60,40,72,72,0] : [28,0,40,72,72,0];
        return(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs}}>
          <thead><tr>{cols.map(h=><th key={h.l} style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,textAlign:"center",fontWeight:700,background:"#f5f5f5",width:h.w?h.w*fs:undefined}}>{h.l}</th>)}</tr></thead>
          <tbody>
            {dataRows}
            {Array.from({length:emptyCount}).map((_,i)=><tr key={`e${i}`}>{emptyCols.map((w,j)=><td key={j} style={{border:bdr,padding:`${3*fs}px`,height:16*fs}}>{j===0?<span style={{color:"#ccc"}}>{rowIdx+i+1}</span>:""}</td>)}</tr>)}
          </tbody>
        </table>);
      })()}
      {/* 備考欄 */}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs,marginTop:-1}}>
        <tbody><tr>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,width:48*fs,fontWeight:700,verticalAlign:"top",letterSpacing:4}}>備　考</td>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,minHeight:90*fs,whiteSpace:"pre-wrap"}}>{r.notes||" "}</td>
        </tr></tbody>
      </table>
      {/* 注意事項 */}
      <div style={{marginTop:12*fs,fontSize:8.5*fs,color:"#666",lineHeight:1.7}}>
        <div><strong>※ご利用前に、必ず内容物確認と動作チェックを行なってください。</strong></div>
      </div>
    </div>
  );
}

// 納品書控（社内用）— 1ページ
function DeliveryCopy({r, g, no, forPrint}){
  const fs = forPrint ? 1 : 0.78;
  const bdr = "1px solid #555";
  const ROWS = 20;
  return(
    <div style={{padding:`${28*fs}px ${32*fs}px`,color:"#111",fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4*fs}}>
        <div style={{fontSize:22*fs,fontWeight:800,letterSpacing:4}}>納品書控</div>
        <div style={{textAlign:"right",fontSize:10.5*fs,lineHeight:2}}>
          <div>納品書No.　<strong>{no}</strong></div>
          <div>日付　{fmtD(r.startDate)}</div>
        </div>
      </div>
      {/* 宛名 + 自社 */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:10*fs,gap:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15*fs,fontWeight:700,borderBottom:"2px solid #111",paddingBottom:3,display:"inline-block"}}>
            {g.customer?.invoiceName||g.customerName}　<span style={{fontWeight:400}}>{ (r.ordererName||g.customer?.contact) ? "御中" : "様"}</span>
          </div>
          {(r.projectName||g.projectName)&&<div style={{fontSize:12*fs,marginTop:4}}>『{r.projectName||g.projectName}{r.projectDetail&&<span style={{fontWeight:400,fontSize:11*fs}}>　{r.projectDetail}</span>}』</div>}
          {r.ecOrderNo&&<div style={{fontSize:10*fs,marginTop:2}}>EC注文番号：{r.ecOrderNo}</div>}
          {(r.ordererName||g.customer?.contact)&&<div style={{fontSize:12*fs,marginTop:3}}>{r.ordererName||g.customer?.contact}　様</div>}
          {/* サイン欄 */}
          <div style={{display:"flex",gap:12*fs,marginTop:10*fs}}>
            <div style={{border:"2px solid #333",borderRadius:4,padding:`${6*fs}px ${12*fs}px`,minWidth:120*fs,minHeight:48*fs}}>
              <div style={{fontWeight:700,fontSize:10*fs,marginBottom:4*fs}}>納品確認</div>
              <div style={{color:"#bbb",fontSize:9*fs}}>Date　　　　／</div>
              <div style={{minHeight:24*fs}}/>
            </div>
            <div style={{border:"2px solid #333",borderRadius:4,padding:`${6*fs}px ${12*fs}px`,minWidth:120*fs,minHeight:48*fs}}>
              <div style={{fontWeight:700,fontSize:10*fs,marginBottom:4*fs}}>返却確認</div>
              <div style={{color:"#bbb",fontSize:9*fs}}>Date　　　　／</div>
              <div style={{minHeight:24*fs}}/>
            </div>
          </div>
        </div>
        <div style={{textAlign:"right",fontSize:9.5*fs,lineHeight:1.7,flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:11*fs}}>オルク株式会社</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><span>担当</span><strong>{r.ourStaff||"―"}</strong></div>
          <div>〒105-0004</div>
          <div>東京都港区新橋6-10-2</div>
          <div>第二新洋ビル 1F</div>
          <div>TEL: 03-5777-1100</div>
          <div>FAX: 03-5777-1101</div>
        </div>
      </div>
      {/* テーブル（機材No・単価あり） */}
      {(()=>{
        const lines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,equipNo:r.equipNo,unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[]}];
        let rowIdx=0;
        const dataRows=[];
        lines.forEach((ln,li)=>{
          rowIdx++;
          dataRows.push(<tr key={`m${li}`}><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{rowIdx}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`}}>{ln.equipmentName}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.equipNo}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(ln.unitPrice)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.endDate)}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,fontSize:9*fs}}>{r.billingType==="monthly"?"月極"+(ln.lineNote?" "+ln.lineNote:""):(ln.lineNote||"")}</td></tr>);
          (ln.subItems||[]).forEach((si,si2)=>{rowIdx++;dataRows.push(<tr key={`s${li}_${si2}`}><td style={{border:bdr,padding:`${2*fs}px`,color:"#aaa"}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px ${2*fs}px ${14*fs}px`,fontSize:9*fs,color:"#555"}}>└ {ln.equipmentName}</td><td style={{border:bdr,padding:`${2*fs}px`,textAlign:"center",fontSize:9*fs}}>{si.no}</td><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px`,fontSize:8.5*fs,color:"#666"}}>{si.note||""}</td></tr>);});
        });
        const emptyCount=Math.max(0,ROWS-rowIdx);
        return(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs,marginTop:10*fs}}>
          <thead><tr>{[{l:"No.",w:28},{l:"機材名"},{l:"単価",w:60},{l:"数量",w:40},{l:"開始日",w:72},{l:"終了日",w:72},{l:"備考"}].map(h=><th key={h.l} style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,textAlign:"center",fontWeight:700,background:"#f5f5f5",width:h.w?h.w*fs:undefined}}>{h.l}</th>)}</tr></thead>
          <tbody>
            {dataRows}
            {Array.from({length:emptyCount}).map((_,i)=><tr key={`e${i}`}>{[28,0,36,52,36,68,68,0].map((w,j)=><td key={j} style={{border:bdr,padding:`${3*fs}px`,height:14*fs}}>{j===0?<span style={{color:"#ccc"}}>{rowIdx+i+1}</span>:""}</td>)}</tr>)}
          </tbody>
        </table>);
      })()}
      {/* 備考欄 */}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs,marginTop:-1}}>
        <tbody><tr>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,width:48*fs,fontWeight:700,verticalAlign:"top",letterSpacing:4}}>備　考</td>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,minHeight:90*fs,whiteSpace:"pre-wrap"}}>{r.notes||" "}</td>
        </tr></tbody>
      </table>
    </div>
  );
}

function ReceiptPage({r, g, no, isLast, forPrint}){
  const fs = forPrint ? 1 : 0.78;
  const bdr = "1px solid #555";
  const receiptDateStr = r.receiptDate ? new Date(r.receiptDate).toLocaleDateString("ja-JP") : new Date(r.startDate).toLocaleDateString("ja-JP");
  const payLabel = r.paymentMethod==="cash" ? "現金" : "クレジット　スクエア";
  const receiptName = r.ordererName || g.customer?.contact || g.customer?.invoiceName || g.customerName || "";
  const subTot = Math.round(r.amount / 1.1 * (r.amount > 0 ? 1 : 0));
  // r.amount = 機材合計(税抜), insuranceAmount = 補償料(税抜)
  const equipAmt = r.amount || 0;
  const insurAmt = r.insuranceAmount || 0;
  const grandTot = equipAmt + insurAmt;
  const taxAmt = Math.round(grandTot * 0.1);
  const lines = (r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,quantity:r.quantity,unitPrice:r.unitPrice,subItems:r.subItems||[]}];
  return(
    <div style={{padding:`${28*fs}px ${32*fs}px`,color:"#111",fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",borderBottom:isLast?"none":"4px dashed #cbd5e1"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10*fs}}>
        <div style={{fontSize:22*fs,fontWeight:800,letterSpacing:8}}>領 収 証</div>
        <div style={{textAlign:"right",fontSize:9.5*fs,lineHeight:2}}>
          <div>領収証No.　<strong>{no}</strong></div>
          <div>登録番号　T5-0104-0109-2630</div>
          <div>領収日　{receiptDateStr}</div>
          <div style={{fontWeight:700,fontSize:11*fs,marginTop:4}}>オルク株式会社</div>
          <div style={{position:"relative",display:"inline-block",textAlign:"right"}}>
            <div>〒105-0004　東京都港区新橋6-10-2</div>
            <div>第二新洋ビル 1F　TEL：03-5777-1100</div>
            <img src="data:image/png;base64,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" style={{position:"absolute",top:`${-10*fs}px`,right:`${-6*fs}px`,width:62.4*fs,height:62.4*fs,opacity:.9,pointerEvents:"none"}}/>
          </div>
        </div>
      </div>
      <div style={{fontSize:15*fs,fontWeight:700,borderBottom:"2px solid #111",paddingBottom:3,display:"inline-block",minWidth:200*fs,marginBottom:12*fs}}>{receiptName}　様</div>
      <div style={{margin:`${8*fs}px 0`,fontSize:12*fs}}>
        <span style={{marginRight:14}}>合計金額</span>
        <span style={{fontSize:26*fs,fontWeight:900,borderBottom:"2px solid #111",padding:`0 16*fspx`}}>{fmt(grandTot+taxAmt)}</span>
        <span style={{fontSize:11*fs,marginLeft:6}}>（税込）</span>
      </div>
      <div style={{fontSize:10*fs,marginBottom:10*fs}}>上記、正に領収いたしました。</div>
      <div style={{fontSize:10*fs,padding:`${6*fs}px ${10*fs}px`,background:"#f9f9f9",border:`1px solid #ddd`,borderRadius:3,marginBottom:12*fs}}>
        但書き　機材レンタル代として　［{payLabel}］
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:9.5*fs}}>
        <thead>
          <tr>{[{l:"ご利用日",w:100},{l:"日数",w:36},{l:"製品名"},{l:"数量",w:28},{l:"単価",w:56},{l:"金額",w:64}].map(h=>(
            <th key={h.l} style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,textAlign:"center",background:"#f5f5f5",width:h.w?h.w*fs:undefined}}>{h.l}</th>
          ))}</tr>
        </thead>
        <tbody>
          {lines.map((ln,li)=>{
            const noDisc=ln.noBillingDiscount;
            const useDays=r.billingType==="monthly"?(r.months||1):(noDisc?(r.days||0):(r.billingDays||r.days||0));
            const lineAmt=Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDays);
            const dLabel=r.billingType==="monthly"?`${r.months||1}ヶ月`:`${useDays}日`;
            return(
              <tr key={li}>
                <td style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,textAlign:"center"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                <td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{dLabel}</td>
                <td style={{border:bdr,padding:`${3*fs}px ${4*fs}px`}}>{ln.equipmentName||""}</td>
                <td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity||1}</td>
                <td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(ln.unitPrice)}</td>
                <td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(lineAmt)}</td>
              </tr>
            );
          })}
          {insurAmt>0&&(
            <tr style={{background:"#fff7ed"}}>
              <td colSpan={4} style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,color:"#92400e"}}>補償料（機材合計の10%）</td>
              <td style={{border:bdr}}></td>
              <td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right",color:"#92400e",fontWeight:600}}>{fmt(insurAmt)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr><td colSpan={5} style={{border:bdr,padding:`${3*fs}px ${6*fs}px`,textAlign:"right",fontWeight:700}}>小計[10%対象]</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right",fontWeight:700}}>{fmt(grandTot)}</td></tr>
          <tr><td colSpan={5} style={{border:bdr,padding:`${3*fs}px ${6*fs}px`,textAlign:"center"}}>消費税[10%]</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(taxAmt)}</td></tr>
          <tr style={{background:"#fff7e6"}}><td colSpan={5} style={{border:bdr,padding:`${3*fs}px ${6*fs}px`,textAlign:"right",fontWeight:900}}>税込合計</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right",fontWeight:900}}>{fmt(grandTot+taxAmt)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
function InvoicePreview({type,g,forPrint}){
  const equipTot=g.items.reduce((s,r)=>s+(r.amount||0),0);
  const insurTot=g.items.reduce((s,r)=>s+(r.insuranceAmount||0),0);
  const baseTot=equipTot+insurTot;
  const adjustments=g.adjustments||[];
  const adjSum=adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
  const tot=baseTot+adjSum;
  const tax=Math.round(tot*0.1);
  if(type==="invoice"){
    const firstRec = g.items[0];
    const invNo = g.invNo || (g.month ? `${g.month}-???` : genDeliveryNo(firstRec,0));
    const rawDate = g.issueDate||(()=>{
      const [y,m] = (monthStr).split("-").map(Number);
      if(y&&m){ const ld=new Date(y,m,0); return `${y}-${String(m).padStart(2,"0")}-${String(ld.getDate()).padStart(2,"0")}`; }
      return "";
    })();
    const issueDateStr = rawDate ? (()=>{const d=new Date(rawDate+"T00:00:00"); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;})() : "";
    const staff = g.customer?.staff || firstRec?.ourStaff || "井上 雄太";
    return(
      <div style={{fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",padding:"24px 28px",color:"#111",background:"#fff",fontSize:11}}>
        {/* タイトル */}
        <div style={{textAlign:"center",fontSize:16,fontWeight:"bold",marginBottom:14}}>ご請求書</div>
        {/* grid 2列×2行: 左=顧客/挨拶, 右=管理No〜MAIL */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"start",gap:"8px 0",marginBottom:14}}>
          {/* 左上: 顧客名・住所 */}
          <div style={{gridColumn:1,gridRow:1,paddingBottom:6}}>
            <div style={{fontSize:16,fontWeight:"bold",marginBottom:6}}>{g.customerName}　御中</div>
            {g.projectName&&<div style={{fontSize:12,fontWeight:"bold",marginBottom:4}}>{ g.projectName}</div>}
            {g.customer?.zipCode&&<div style={{marginBottom:1}}>〒{ g.customer.zipCode}</div>}
            {g.customer?.address&&(g.customer.address).split("\n").map((line,i)=><div key={{i}} style={{marginBottom:1}}>{line}</div>)}
          </div>
          {/* 右列（2行分）: 管理No〜MAIL */}
          <div style={{gridColumn:2,gridRow:"1/3",fontSize:10,lineHeight:1.9,whiteSpace:"nowrap",paddingLeft:16,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            <div>
              <div style={{display:"flex",gap:4}}><span style={{minWidth:52}}>管理No</span><strong>{invNo}</strong></div>
              <div style={{display:"flex",gap:4}}><span style={{minWidth:52}}>日付</span><span>{issueDateStr}</span></div>
              <div style={{marginBottom:8}}>登録番号 T5-0104-0109-2630</div>
              <div style={{fontWeight:"bold",fontSize:11.5,marginBottom:2}}>オルク株式会社</div>
              <div style={{position:"relative"}}>
                <div>〒105-0004</div>
                <div>東京都港区新橋6-10-2</div>
                <div>第二新洋ビル 1F</div>
                <img src="data:image/png;base64,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" style={{position:"absolute",top:-4,right:-4,width:62,height:62,mixBlendMode:"multiply",background:"#fff"}}/>
              </div>
            </div>
            <div style={{height:"1em"}}/>
            <div>担当：{staff}</div>
            <div>TEL：03-5777-1100</div>
            <div>MAIL：invoice@olq.co.jp</div>
          </div>
          {/* 左下: 挨拶文・ご請求金額 */}
          <div style={{gridColumn:1,gridRow:2,paddingTop:"4em"}}>
            <div style={{fontSize:10.5,marginBottom:8}}>毎度ありがとうございます。下記の通りご請求申し上げます。</div>
            <div style={{display:"flex",alignItems:"baseline",gap:12}}>
              <span style={{fontSize:13,fontWeight:"bold"}}>ご請求金額</span>
              <span style={{fontSize:22,fontWeight:"bold",borderBottom:"2px solid #111",padding:"0 10px"}}>{ fmt(tot+tax)}</span>
              <span style={{fontSize:11}}>（税込）</span>
            </div>
          </div>
        </div>

        {/* 明細テーブル */}
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
          <thead>
            <tr style={{background:"#f0f0f0"}}>
              {["ご利用日","日数","ご発注者","製品名","台数","単価","金額"].map(h=>(
                <th key={h} style={{...S.td,textAlign:"center",fontWeight:"bold",padding:"5px 6px",whiteSpace:"nowrap",background:"#f0f0f0"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.items.flatMap(r=>{
              const rLines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,quantity:r.quantity,unitPrice:r.unitPrice,amount:r.amount,lineNote:r.lineNote||""}];
              const days=r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.billingDays||r.days||0);
              return rLines.map((ln,li)=>{
                const lineAmt=ln.amount!==undefined?ln.amount:Math.round((ln.unitPrice||0)*(ln.quantity||1)*(r.billingType==="monthly"?(r.months||1):(r.billingDays||r.days||1)));
                return(
                  <tr key={`${r.id}-${li}`}>
                    {li===0&&<td style={{...S.td,padding:"4px 6px",textAlign:"center",whiteSpace:"nowrap",verticalAlign:"top"}} rowSpan={rLines.length}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}{r.billingType==="monthly"&&<div style={{fontSize:10,marginTop:2}}>[月極]</div>}{r.ecOrderNo&&<div style={{fontSize:10,marginTop:2}}>EC:{r.ecOrderNo}</div>}</td>}
                    {li===0&&<td style={{...S.td,padding:"4px 6px",textAlign:"center",verticalAlign:"top"}} rowSpan={rLines.length}>{days}</td>}
                    {li===0&&<td style={{...S.td,padding:"4px 6px",textAlign:"center",fontSize:10,verticalAlign:"top"}} rowSpan={rLines.length}>{r.ordererName ? r.ordererName+"　様" : ""}</td>}
                    <td style={{...S.td,padding:"4px 6px",textAlign:"center"}}>
                      {ln.equipmentName||r.equipmentName}
                      {li===0&&r.projectDetail&&<span style={{color:"#555",fontSize:10}}>　[{r.projectDetail}]</span>}

                    </td>
                    <td style={{...S.td,padding:"4px 6px",textAlign:"center"}}>{ln.quantity||1}</td>
                    <td style={{...S.td,padding:"4px 6px",textAlign:"center"}}>{fmt(ln.unitPrice||r.unitPrice)}</td>
                    <td style={{...S.td,padding:"4px 6px",textAlign:"center",fontWeight:"bold"}}>{fmt(lineAmt)}</td>
                  </tr>
                );
              });
            })}
            {insurTot>0&&(
              <tr style={{background:"#fff7ed"}}>
                <td colSpan={6} style={{...S.td,padding:"4px 6px",textAlign:"right",color:"#92400e"}}>補償料（機材合計の10%）</td>
                <td style={{...S.td,padding:"4px 6px",textAlign:"right",color:"#92400e",fontWeight:600}}>{fmt(insurTot)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {(()=>{
              const pc=g.customer?.paymentCycle||"";
              const [my,mm]=(g.month||"").split("-").map(Number);
              let dueStr="";
              if(my&&mm&&pc&&pc!=="スクエア"&&pc!=="その他"){
                let addM=0,dayVal=0;
                if(pc.includes("翌月"))addM=1;else if(pc.includes("翌々月"))addM=2;
                const m2=(mm-1+addM)%12+1,y2=my+Math.floor((mm-1+addM)/12);
                if(pc.endsWith("末日")){dayVal=new Date(y2,m2,0).getDate();}
                else{const n=parseInt((pc.match(/[0-9]+日/)||[])[0])||0;dayVal=n;}
                if(dayVal)dueStr=y2+"年"+m2+"月"+dayVal+"日";
              }
              return(<>
                <tr>
                  <td colSpan={4} rowSpan={3+adjustments.filter(a=>a.label||a.amount).length} style={{...S.td,padding:"10px 12px",verticalAlign:"middle",fontSize:10.5,lineHeight:1.9,textAlign:"center"}}>
                    <div style={{display:"inline-flex",gap:24,textAlign:"left"}}>
                      <div>
                        <div style={{fontWeight:"bold",marginBottom:2}}>お振込先</div>
                        <div>みずほ銀行　新橋中央支店　店番号　051</div>
                        <div>普通口座　2333044</div>
                        <div>口座名義　オルク株式会社</div>
                      </div>
                      <div style={{paddingTop:"2em"}}>
                        {pc&&pc!=="スクエア"&&pc!=="その他"&&<div>お支払い条件：{pc}</div>}
                        {dueStr&&<div>お支払い期日：<span style={{color:"#c00",fontWeight:"bold"}}>{dueStr}</span></div>}
                        <div>※振込み手数料はご負担願います。</div>
                      </div>
                    </div>
                  </td>
                  <td colSpan={2} style={{...S.td,padding:"5px 8px",textAlign:"center",fontWeight:"bold",background:"#f0f0f0"}}>小計[10%対象]</td>
                  <td style={{...S.td,padding:"5px 8px",textAlign:"right",fontWeight:"bold",background:"#f0f0f0"}}>{fmt(baseTot)}</td>
                </tr>
                {adjustments.filter(a=>a.label||a.amount).map(a=>(
                  <tr key={a.id} style={{background:"#fefce8"}}>
                    <td colSpan={2} style={{...S.td,padding:"4px 8px",textAlign:"right",color:"#92400e"}}>{a.label||"調整"}</td>
                    <td style={{...S.td,padding:"4px 8px",textAlign:"right",fontWeight:"bold",color:Number(a.amount)<0?"#dc2626":"#16a34a"}}>{fmt(Number(a.amount)||0)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{...S.td,padding:"5px 8px",textAlign:"right"}}>消費税[10%]</td>
                  <td style={{...S.td,padding:"5px 8px",textAlign:"right"}}>{fmt(tax)}</td>
                </tr>
                <tr style={{background:"#f0f0f0"}}>
                  <td colSpan={2} style={{...S.td,padding:"6px 8px",textAlign:"center",fontWeight:"bold",fontSize:12}}>税込合計</td>
                  <td style={{...S.td,padding:"6px 8px",textAlign:"right",fontWeight:"bold",fontSize:12}}>{fmt(tot+tax)}</td>
                </tr>
              </>);
            })()}
          </tfoot>
        </table>
      </div>
    );
  }
  // 納品書 / 納品書・領収証: 各1ページずつ
  return(
    <div style={{fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",color:"#111",background:"#fff",minHeight:"100%"}}>
      {g.items.map((r,idx)=>{
        const no = genDeliveryNo(r, idx);
        const isLast = idx===g.items.length-1;
        return(
          <div key={r.id}>
            <div style={{borderBottom:"3px solid #2563eb",marginBottom:2}}>
              <DeliveryCustomer r={r} g={g} no={no} forPrint={forPrint} showPrice={!!g.customer?.showDeliveryPrice}/>
            </div>
            <div style={{borderBottom:(type==="delivery-receipt"&&r.issueReceipt)||!isLast?"4px dashed #cbd5e1":"none"}}>
              <DeliveryCopy r={r} g={g} no={no} forPrint={forPrint}/>
            </div>
            {type==="delivery-receipt"&&r.issueReceipt&&(
              <ReceiptPage r={r} g={g} no={no} isLast={isLast} forPrint={forPrint}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 印刷用HTML生成 & ダウンロード
function downloadPrintHTML(type, g) {
  if (!g || !g.items || !g.items.length) return;
  const title = type==="invoice" ? `ご請求書_${g.customerName}御中${g.projectName?"_"+g.projectName:""}_${g.month||""}` : type==="delivery-receipt" ? `納品書・領収証_${g.customerName}_${g.month||""}` : `納品書_${g.customerName}_${g.month||""}`;
  const css = `@page{margin:0mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0;margin:0}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:3px 5px;font-size:10px}
th{background:#f3f3f3;font-weight:bold;text-align:center}.r{text-align:right}.c{text-align:center}
.pb{page-break-after:always}.title{text-align:center;font-size:22px;font-weight:bold;letter-spacing:6px;margin-bottom:4px}
.hdr{display:flex;justify-content:space-between;margin:14px 0 10px}.cust-name{font-size:16px;font-weight:bold;border-bottom:2px solid #111;padding-bottom:3px;display:inline-block}
.olq{text-align:right;font-size:10px;line-height:1.8}.amount{font-size:20px;font-weight:bold;color:#c00}
.note{font-size:9px;color:#666;line-height:1.7;margin-top:12px}.sign-box{border:2px solid #333;border-radius:4px;padding:8px 14px;min-width:140px;min-height:70px;display:inline-block;margin-right:14px}
.sign-label{font-weight:bold;font-size:11px;margin-bottom:4px}.sign-date{color:#bbb;font-size:10px}.sub-row td{font-size:10px;color:#555;padding:3px 7px}
.empty td{height:18px}.biko{font-weight:bold;letter-spacing:6px;vertical-align:top;width:50px}`;

  let body = "";
  const fd = d => d ? new Date(d).toLocaleDateString("ja-JP") : "―";
  const fm = n => `¥${Number(n||0).toLocaleString()}`;
  const fn = n => Number(n||0).toLocaleString();
  const equipTotG = g.items.reduce((s,r) => s+(r.amount||0), 0);
  const insurTotG = g.items.reduce((s,r) => s+(r.insuranceAmount||0), 0);
  const tot = equipTotG + insurTotG;
  const tax = Math.round(tot * 0.1);

  if (type === "invoice") {
    // 請求書HTML — Excel雛形準拠レイアウト
    const adjustments = g.adjustments || [];
    const adjSum = adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const totIns = g.items.reduce((s,r)=>s+(r.insuranceAmount||0),0);
    const grandTot = tot + adjSum;
    const taxAmt = Math.round(grandTot * 0.1);
    // 管理No：先頭案件のcreatedAtから生成
    const firstRec = g.items[0];
    const invNo = g.invNo || (g.month ? `${g.month}-???` : genDeliveryNo(firstRec,0));
    const rawDate = g.issueDate||(()=>{
      const [y,m] = (monthStr).split("-").map(Number);
      if(y&&m){ const ld=new Date(y,m,0); return `${y}-${String(m).padStart(2,"0")}-${String(ld.getDate()).padStart(2,"0")}`; }
      return "";
    })();
    const issueDateStr = rawDate ? (()=>{const d=new Date(rawDate+"T00:00:00"); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;})() : "";
    // 担当者
    const staff = g.customer?.staff || firstRec?.ourStaff || "井上 雄太";
    // 顧客住所


    body += `<div style="padding:4px 38px;max-width:760px;margin:0 auto;font-size:10px">
      <div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:14px">ご請求書</div>
      <!-- grid 2列×2行（ヘッダー固定高さ：窓付き封筒対応） -->
      <div style="display:grid;grid-template-columns:1fr auto;align-items:stretch;gap:4px 0;margin-bottom:8px">
        <!-- 左上: 顧客名・住所 -->
        <div style="grid-column:1;grid-row:1;padding-bottom:6px">
          <div style="font-size:14px;font-weight:bold;margin-bottom:6px">${g.customerName}　御中</div>
          ${g.projectName?`<div style="font-size:12px;font-weight:bold;margin-bottom:4px">${g.projectName}</div>`:""}
          ${g.customer?.zipCode?`<div style="margin-bottom:1px">〒${g.customer.zipCode}</div>`:""}
          ${(g.customer?.address||"").split("\n").map(l=>`<div style="margin-bottom:1px">${l}</div>`).join("")}
        </div>
        <!-- 右列（2行分）: 管理No〜MAIL -->
        <div style="grid-column:2;grid-row:1/3;font-size:10px;line-height:1.9;white-space:nowrap;padding-left:16px;display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;gap:6px"><span style="min-width:52px">管理No</span><strong>${invNo}</strong></div>
            <div style="display:flex;gap:6px"><span style="min-width:52px">日付</span><span>${issueDateStr}</span></div>
            <div style="margin-bottom:8px">登録番号 T5-0104-0109-2630</div>
            <div style="font-weight:bold;font-size:10px;margin-bottom:2px">オルク株式会社</div>
            <div style="position:relative">
              <div>〒105-0004</div>
              <div>東京都港区新橋6-10-2</div>
              <div>第二新洋ビル 1F</div>
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAA+CAYAAABzwahEAAAAAXNSR0IArs4c6QAAAIRlWElmTU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAD6gAwAEAAAAAQAAAD4AAAAA1hlH+AAAAAlwSFlzAAALEwAACxMBAJqcGAAAIU5JREFUaAWtmwmcXUWZ6KvqnLv0ms7Sa9Kd7hCEJBjS6TSrMsEBcVTwx2jmiXnzxhEHdwRlQHzDiDPqGxdAnzMO+lNhQEUHH8PzsQiK7EJIuhNwQgIknU7f9JZOJ+n1budUvf93bt/OTSct6HuVdJ9zavmq6tu/r6q1ohxYetZiF4SbnVLnKO1qlNZHldNprWyNVapGK22kX6G4tNZmwDlXRf/aYq08jXLWKZ0qrZvnXStlRxk/Ke18MIWu1M4sccDgkx/XxE+Sd7r98QV4svZxJjjsnNptrbmjbWTrsB5n00eD/IvKaGudfoAOE7rQmfUo+mprdLiItioqpp0yI7R70kZfy7osb0ZWK8ubGSuvcwv9GTTTj9eZTyBoV0XDIuCFxXbggMT5C4MLzZoFuAj0bOcilWZhadbp3FI6rONnOqbsuf7hMLjC0zp+2AZtZw6/NDU7+g2+9NavbVs+/NJ+FsLe/7Cye8n5VXVhxiw60j32h40s9D6wtP1MpWKjzf0tg0pBj5mi1RNB8b30ub++c4XW4bOB9r7kg7dGS88/ZtN9je0bQPa9ffXrP6WGux8onaT0vafu7PqYDv6augebh7t+V2wr96e/PelH9Plgse6NPnua1l1sQ32PUvmDqYY9L7AOD0giIypl2kfhwiMh2DDOHHaeS40o1b18YGtPqn7DL5yyf+rDKWDHDM034b7WjclEbqJyyoIeSiU/maTLt/XuOOqcaUOuW2H/uvnGS73v5ZqtM9d4Su/hc3bjiNHFcOy8c/8+mHHmZkVVlcpbHCq3KgPDwdpTskjWZYTNY0olK0HHUZs/3KDMf6PpQQTsKPMaX4AbtJg89zas64xr71qEK6a1igEhqTPjPpgrT8wouBws7WdMNtXQMQKQUz3EK9D22lTD+k28ZkKjvtrW3/28wCstyGwWqiworZN3FpqfW/d637IpNOiqWh2Lj7jgVmXtk6w3b5XJgFyaI7ggwumjNniHUfp6q91FNDyUQn8xp4s2XpyI3aKs1Zug4hKeI2wkB/a0p+xhMDMNAM2oBpRJc7k2G2WGvODZqWbZNPOEBpYrwis+wbB0lUeCF9Yog3hhZZGKK3Z8g8/Bpo7TXGg3juq8grT3LhvefgKii6D2N64fB+GbIGJ1l+rw65lVpj1u43sHF+xY0TJ6sQnLjPXS1o57TmHQcuMJu8CbtMiJSsTKF8ZceMu0s218PshPB3bsG1PGvysZy4WtvTWRiSpOXPIEN65CqY0g5uTKp6TvvK87a9dUBlZ9rsbz14258D/C0OudtzMN0ZxOJTDIwYSqcvUFC3r8xi+UBfWpI8cBOnrsCzKZ/Y3tlyww/qZxJg10eHvMet83zjt6ev8Lh4uUPDai9A1mcqa6t5U5e9VJtW5p77nvB2s7G3KevQlqXepr1TxmwxSb+hY2+ffqCGP9mNU2AXcNy/76VAfLFJ/jDyi9tZ1rPWt+Nm7DPZ42/8jgEfjGgABkVyg5T7HeQq3MAkH/PD1OqBaRuHlmfYLwtLGvIiEfp2NTTtkdnjFXNA9tf/KEgXMqnAlqGLcAhEV6rNj8hje+t6mjxffCB3E20sj515cObNuuApMUkcHxqNyz8sD8G2e2k3IDOqW4kLnP/trOM69s2HCJU5sErjOe+nKotXDX5snB3NnM/+zcMSf9tmZhpfZ8LMBAaftxMl7aUPo+uujs6ukwd4/RpilQ7uvLBru/J+0uWvi8ay8FIaTGQ1Pp6YqREsy7cbRbxHrHdebDeuFmGj7ycu3LTWtGEMyBrq/O7fNGvmHz5nKM10QQ4uQcK69L8X8H45OJ4JYy450XavWT5UPd1x8bXngTH31u3ZzvSMDpd2jNzp1YxEJh04cFfcXv45+6rkx7VZ4L5mk/vvfJvgaaOpZgiVYdDPNp59lR6VME9nsp7jZu9Pt293ypQukPTyn7a5u2nyidAAcBB0DMg64am14wL6ubyIzpOGbwONcURhcuOGlBJpNicP9fSt655YA4HxgvBnlzsBTWvBRPLTu3rO+ViVuSWt+QdnaLs/5VbUd3lOh4oZWRQCKEnNWVucl5N46LKJ4dqs1FWC9dwLzvWi2asCFeqf/GZGkOoMfVRpS//pNFxm8CwNPZkWxfaZdo44L40sr9LZ0rXJj9MZS+OuPsc87qza3DL+wr7SPvobYTPKbZE4hdMre55FuvAE1HnOfB2q9fcJNrYIVGevYtjCVfT4xOCrC1aWIliL6OIIwQWz21Rh0TMRkg6CRoCyNf+8X6tRULlH+NyYWfrjBe7aSzd+mYu7El1X2cRizO5BsfkgRC9XmZsndJBxtwnfTZ7euc+ECvW2KZifPxvJuM1r+cKh/DY/7DymBDe23eujvQ5o2Tyt7Vkxz99VwIpsDrpkwaFqnYhxZ43pcQ2viUDT+lvfhHW1LbT7pp6Z/lH4U9zV+8pG5PaP0OcPPMsv6XDszf81gLJvM9lcYsRCP/cOWePbPK8FiP+d/6m9adl1f6OeY8Z9KFL8V99Y0Le3szc0cUlVtEMRdXDx3Nh5NJ7R5oHNp+HHVSy9YsckHyKU+5n4e0ay+50+Vyq3GBlqKtg0WaoGdO2dewrtUF9gbQM2SVfXxOcxFj1VIv1mOT6jH7G9TfoDM2Tzn3kE26bSxsFi4vurd1YyI7mUevHlKLES+vOmOmplQL3cgeqfcTtb0tTdRCRLRN++rKhgPHwuDS+QsbL5BdtaS69tIoPyeUwK+d9oLxw/iaN5Yp7wsmzKu8jGNlgVOvjIyo4yizr3VdjZcxf5vU5gIW8YW2oR1PzAVqPLcDQ/iRA43rb7Wq51Uip8uJDt7OBvEM3XXNhL6lY/qXnrXIy4z/S7mvLlOqwgY6U1FGPOYxiNhBocUzKOJeFnUfYf5NTQe60D8nL4WNOxfx7Mm7FGrbep8Qdrmgt3H9n2ecOw9z0yLUQDHu8Dz/njWqe3bjQpn+fKwVVr0o6+wNzUPdXzsZ7GRu6sYMQQ9prUuBVIaKnEDj/MAY/+am/i0niIVx8Jo27C/soV/AS3DY5jO8k3hQg6QitmrtPbLsJGPnzi/KjcBTD0vDNtUR26C68sKi+OLNE0F2++qRTdN7Vm6Jnbrn4Qg5rYPd99FVftQg/ZCnJWM1mQnVLzXHSsIEB3NO/z1Jgr29dZ3nad/O8FWhjwlVfhqrENPm03BNC0gKR4NwjzD2QmVXpRo2rNWYlqXLzFO6qyuK2ZsGug4x+i+HUMITuTIvWW7yzQeeS/fXrTvPau8C3/qPNQ49fwLCjq3q2FtEcahm9xH9GGNv7HFnfMXX5mI88OsWxP1Lext/sSI5qT6AXf+IDYIVpPbeX1Hlf33xni3jgfI+CqXOqR7zNwOyP1W3/nLn6TY92HVrX2DeT9vfEV9Y4JLqOOaqCJvg7goip9G+EtWN4BTsX6h9Ep3qdN7XYftr6WMGB9VK+vXJkkl1XUBM1A4XJWPxPAZFu76m9urQ6isrcacnXe7PU00dDyurR3AuMp5xGRua4emY6V7V/8JxPsTMxp3xPXU6SuXjno6Rk3L1JCDflHO+5HDOxYn5Syb7PKtnYnfD5FT+ftbRBZUcOa16OLtcFoai28xm38PbraEJf+OFXlrIjGnKwMZHLWJIkg9igwSRBw9JtmR6lL1Qa/2xSiKRCRfCtu5X9B8OlB7OZvxIzvsaOr5B/aYY3JFEazGcQqDNcLIfeFFwivExm65zQpKquNHY2Rw+1pHK0Pb2NXXc3DLQ9WhhHHZ8ZrzGrsVCVK/RxK8ujOrjBCGySNIw0M3zQp1PQJE0/cRbhU/YuSalZgsZQ/E0cN+isW39O3bwuWOo/qy2wM83uNAjGWBDZ2LD8UDls7L5GQsN9CNkPzsJd9cy5feMMr8KQpMNAvOfpx7eMk4W5So2/VngIdfq24Gyu3CDQ4bryZBMedEBI/1D+Gucs/UwVSW7b0SM1qFgz01bdzv2/WyQCT5KMzCSGogCQIICZ47ARTmTh4m8GC0F50kacAPLMWmr6f08s8QAEjc2Fsk/uuIMyfJJSS1bd6oLzP05FeAFai9K69EmDk8W7BUL8EArlhuEUQ1ofS3fVxsT6kTc6n0165og4CdAU44U2FVLk0d/NphbXGfCZMbThDBuqpGkYRLEgAp9KK68SWPLqAkM1EkfiudClbZ3LDb+5Yet3iDzyNwFissbqC5XJo5ZeAuJLJKLJp711duAdilsL3tPq7h6Kh4YP6Ptv/Y1rP8yWK3BhicDldva17i+gk2XQYXHBVwYeB+lDQTpu6h/hGUlpF5Kyb75QsA4kWHnouQWsY4u0LwftYCn7F6T+IC5VjImHTp9IJVZxKmIi2HKGEaJVCYjBCg/WcldGn4gLUgNE6G7jgl+M67Cy0FoPSLlyYTRxiGjtX5u13TgDzP485hFjLIVBrid1wAF9Nvm4d8eRMFN5FT+fdDok9TXsoA40VmcKffBPUNs7ncg6badak3cKIs3qMex1Q+O9Wfvjy+qTMo6S0uN8d3+eCasCfOVMe2fTdvywARXruh/cY9SG1lWITfH3srZ2hG4dIj86CjzABspnC1CGTUGIY5Lm7FRcKUPMr4a0wdD2Ebfoc1YrER+ML1raz7wYj8OyVls6ItMsreM7Bzvz6GPP9k83H0+gUPShtlvAuxvGDIENsmPa+Fa4GqUlw5D6+rw3L+2sCkJ23oPMD7pWf2zusaybE0iHJv7k/Uz43XWvRQz3iVQfDeyuCEW+E+Qqn6lr378yf317RcV98Y8dvnQizvJKK9JxL3100F5a3NlQ1OYXLA0TFY3aT+xOmbUW0p/Wirr39I60PWTwj41KtEcEkYSmJEdRzyij3jgajhiO50FN4tC47kGxdG6p35tXWViMJ3JVjSDOPJrSqgX/ZDHRke5OmQzNEbXAUhglTcPbXsI9r8MOOfi2UTwgSdKQng7YlD5heyOeyZ83NnYjqyyq/luYJO1pLrPC7T+2c0zB5OMNf21Z7bbIPdTPMGKcj9zNDWZTjO/wEZhCXcLXCBQRHekJoczqfr2u9Dxcg4ihM5H8/MqMWs54m1HlpxWNe2pO8H8CkamaDuFnruTynzOab++9pWXPkTdO3eu2RSvGO05n/VfwHctRzELSUftQo7vVyb22PIZr+k10lXo13FOYf9XXJkpzKHwUIXxjWcDOwELujxvVXmTy3ixJeLAoIyuzQUm58d1dWDtf2DXV21as8ZXBQtMwtSrhzuZktPcwgZJV7tWrE8ZBFKE0OKiivmrgGwoXh0y6XZMLoFEhJsIKbSLjJvFQpC0X306qrEdM3Md9Y2o4c+GSl+H7/t1sPrXR1o3fuZXvbUTVYf3/i3Y/WRc6QYOE0I2JPbgrWD13crmHsfru6p1aMf+VDI4B9b/PyzycFaF06gambTCchTFWeuQoN93JpH2I3e5QkQFn1/Sgt9fOrD9q32NHQeAuapqvIZAP822VNA82P3L/Q2dl8ExaSQ1D/LKwjD4MFxFZsglYaXLEOoRQTAULRc/oSxtt04m3RWc+GgWOsm0kW5g4zA3lUj8gpxyE9DjtzZUfxZHIqZMfige6t+BzbPT2dyCsxr3NsIRX2ID3RyYfJCg7CrW2smEH4eFWj1lvg0j38YiL0+ZYKcK/Gv5bmJTgFZH6BdTnm7m/ZMwIwkCezsJTPEVJO/N6Q3y53m7gC/ygGfoVDJjy7FjswWzMZrxg6vB30oqy5mrGcKUA+N5kNuBiGyQzlbr3zQPbP0u7a63Yb3ngzrcsSOhswtAHLsrKVAS58WrxJ9KlyEuR3O6HJwMo+DENiA1+gxYiCp1e9PgC48caOh4D2PSIG4Xp6AP9NV3vB/4RE6sBmXJ4zsl4GdfUV6b6fckefGbipWuoyOmuk5hqnuL2jp6ioPA1KAAL4fMzHhm/NqYM9ejCJFT3BXajthgDApfD8c8UY0rJgOJxd+Nt7daDXVdDeEiHYMrRxdVTXPBnGEeCPHCI2DdQxRjuH9TeWxaPEYLvqd0jErkCemsdTYyG8RKOSaGPQuHjxBvCBiyFiUJgSjqUkZMUXQtAdhYPzCuOMtx7mIWdhMwJtEXev8AvRp6dK/tfK714NbfFiY8/nduOreY/Z4DJ+Rwbb9CDvrZmGczLGBXIyc5B2rXnzYWc2sQZzkuuYnRF+5detab2EQed5mV2mV4m76ovxmKi9OTn4yhN2amghtOWmiXFhibwi/yBaB9ZpSzJjWDXDw07y8SRn8ahVOkGAPgMQAIBJ44NO4fxGeIvvhNTKAyJrwP09ntMuMRlcRtjkIz6RVNJt6iSqGqHmkb3vq8jJ4tI93Yf7WHqy3P2DC8kPdVfuBapB3Q+PMSesiCZzcuTf9/C6x/TV/92u87U5YwXnZcqbLRKryZ0llQ5HrK5ojb5SYJMgO2SKMPSOyP2OB3IpfBwZF8XLgTHikkNwX1VUQHTZFvMTYx6xEKDL8KJgzzy9jqm+l4UOncoHV+J6e7IpMi3hC/xFdP4I+iIETJRRZesCKFnjL/TCnYyOIXrbTMNgpJ4iVfCo+nF3tRjtedsPn04qmYL2FKHMmKxCHwNOeAnPUWzLyiIWeN10ZQguZ255LsDJYd3jPZ37CeKbWrO7jl4IGG9QMkEc+dcuHdZGMGvQS7QFZkTbIrnYs1w4IJcm64r/YxcXoIZy8RrkGEcTXUYek9q9xsPiAgMYdRDRxEehEvB87D7LpRNEJYls/mAtKkgE9IeBlNpLS4jj6V0X7hyuoo9KERdjszEwaEsqqNOKpJeWYJtlmQyPbF6oqf7MZiRsuBHu6x5iyX5YCSEHs3qcIx0PpFxtsB6euI9JmsT3lfJZ6QbM1S6qqBJC5muVCS/aMLNdrCZXFy9oGrb8k6sVljmFY+Iz99knUWLwY4HVTUpMDg9RO5it+VeenFXAZ6xgtxNBLuXh14Qe2hrsGeuvZnOaW8G0dFQk4B1M+sj9u8EadBfPsfgYTojMrlg1PQaGeC3F42s4NFH2SBsLw6iG0j+HOYcZXAb4jYHPH3SWmVAxTdGV2r2rN06NKHCPvxyNzTIOGgzNEytHUrj3dxPHQ6pFrgvACuiS2AQEE2byflcgM3IyYnajOp4nFVPgi3QcoHMaWvoF7XCByNZr0TRFa1DHW/VypeIyddbrxFoQvr4zaWGguyuaQfT/iei3FC+YqkfRpmbkf1NXecwg2ad1sX+99tQ8/3yng2KpQJo2tkNvgoiM4ZYw6gPSc9xIu7bCbPk5hx90xyU4ZFRby9eDI8G8pVwOqp5YPdXdIgN6ug2luxDfgErhnaVYrzASmxMCoNEkPhFOblvwgOCsyZHN6aXE/D2IBiTg/QC/+Ut/pm4L83YnUW69zKlYkDU9X/Ezl5G7G9cG+Yw+NLxjxUvU3AKq6vccM/Nwxuu02AS+E0oQqyXUmoLGdid0qdbBp4OhXmVsC3N7Ke6AYdDZ6QFpce3kSdBDqVqu94WJSgjNsHBY3N/zMU6eQzCZxR7P1tPxjqvoWcwFJ4/YskH1qrydJIHCE2FlcYCSKS5Ftgc08nsu28Cpcgj2Ln2SbshHhk4agfkJNleSUyrvfsyZLm3U1tI8s7As7wY9wikQvicxCrUrG8e1IGSdnf8uaFJHYuo341aLsG6j9dpCCLdkPOvpzX+l1Q5wwmTrAyxEEkGazgTsLPX+HjKnJ9d3KrYQfpnfaFnvenOCP3we7PMu/n2MzXrl7Y8b3JUP9Xoi4Sm27bWBg+zbgP4sAsxEnZyq72sbV3ssFKlNkj+A7PInLgjx1gpXkcgVPSynh7Vgxu3X+gqcMTmx5RnMXIehTn3kLNb6KYFpW7eAVXqHQZLWmdnZrJcKrRpWuXTYX+dzCulwg12Ti70WfiOb+caux4gnT7B1vRByIO+O378a6WcWclTHhmR+PAu19V6maZzJJcEFX9VyhTTI/aQW5rBVlZ1qkeXT64/bv7G9afRwLxvdPl5PRCdKtzOXjny6E1z2svXMWO3gHCb20Z7v4psHYi26upu+2FwRW/XsHBRGFLkq+uchtVLcu8V5hCFOoyiFFwWREWi+zW5bS/BYehNQgDTgJx6VnilEgt/zEjwk4/nbCqp0KbSwleXqJZnP7z6NfDZuA493Y48WEGriO59/aE04/kUDXiWsq1sL6GX9yQq1z5LQV3YZRfgyIMg74g8IDELPJG3o86KZHHiKqSPtIRvlONvSMVh05pGO+pghGPYgikI5y+Bw9wNSNr/qLg8kZjpW1uYdMgBWDyS9hiompa5PTnCPf9zHwf2BuOtJRWT/MtLPQoU/+KDXTgjfVhgq4gELiBdWMX3S/GhzKRBmeTZ8Ixb8Il+TCRm4jZt9j3Z3gfAEnXJMeqm2XOiLbyQvli4RH9hmXZ/bGC9aOre42NC/5Olws8+DvbpROIuhjtji7WjwUcLgD045L9OTZ6/rdo4wDVp0IF7YffBMPf5OTjfXDBFvSZStjgzzBht+A1/fiHA9vvBHgdkwaE1SF5XZIREEOruBzDAucQCFNBECwD5avpNwCM782I0FOwY2PWyJiTFg07I1yiWI+VvA0QJfuo5P3gqItA6mId6K1c3NtNKLEZO/HOTPnYnRDnVbJGF1TXx+/ob9pwfk/T2tN6yfD2LWlv6mtux8tbV3MM6gzFWXCEZZc3n8CzvifV0LlBMEI8Hk7ky1AG9kdkL//tymXn1rC2Cvrnsy7MRAqiAK0wfgYepzAwQ+TFifUqbhQXjbhUk5ymwHLRGHn/gvxC7mgPuE543EXiBDLRMrRjK3L0eEzp1S4M7nSZXIoBPxR+BlFfqR5fXAarf0wuMCSN94FqZZ7xrfecp8OH4ZN74IV7vYz337dJBDiz1xlWF5UTKapaEBtFS7I6cehDEoKssCIvvlNOL+RdNHzei1WMh9z9otsJRdiYPrU0AIZUKfaZ9xrU7JGArIsMADcoXzoS/co3/anH2IIR+S4WkBF940p+TUJRCPMnujz5XxJJ726AP7BY+6fmvPz5bV5yK3b0GkTqOzhfT2O/DwJTxkIo0s/sr6wrMwt7lmhfoCUlnqxsa7ZZcRQbXXkQDQMJyYnzLQWn+xjJClXH/2ZmqcCDc8nyfBVucBUDsnH8LKnHwpJZAaehGgO2TTku10bKrjg5JKB4Xjx/oLHjH0F7J2ltgLoKAHw2mwkv5LkS/xqqq79L5bMfYfXcZ+WiBhERsGVvgkafeafJcTwp4rhfddCtxI7LJFHBeAsbFli9WHnik2BiJkV5YluBjd1hWkwsLkc8CYzEdFo2Kj5VNAJLKXwh6QT5tgZ+KqU2J7j0VX5eBZwEX11nYtVRiMsxCwrwFNjlFGF1sRoAaJdfRH/yEO6JfnhE35yXy0Xbz5MefwbHVlzfwlGRdJBSSMjpalKvC0LcJCHISYqsPBYE6apkKHSX6U8sLGCC2pqASGxfnz9xSoMaQ0aboIPImawoUmLcJomYCEq2FhA2Iz5GH45k2LNxXM03HwpyC60Xq+aigYWUEXE4FAwAsgrR4pKSWTIaBpf6Tu7ZFMSDSaINsMybOEl5x5CbXuIrOZh0zbOsLmsRUwKroF9AqrzNKdZw1uuCARbYCkeUFyx9aacCvtHsYiyjSWEgHd0hdetHEoCdtOHdxAdyMHkFI0nGq49x5j6JN/VZCLyPaC26eoKwkzcQwc/VNg9sf5ns7tCC0Z6LA8/VcBJazRQL4elDSMdprCch1gQV0YlW2olYCMOyESJ+IkhWxZVSQQPrioyD4obITLlXbdLnuL3wXXRzv1gdPRkUbUI+GEt2UzAqoOYWFymquE70BC4b7V0UnfTi1vx3poJwJYDeSl0UYEs1sK7GexYm56jY/lPTwI5nilBlUnRBpRxhe4f37oIwNeJpS2f5L25jYaiyHCaKbN8EudiCWNjCoqFg5CgfskFX3EseIg4R9yQ1u/EVTT3iTzeykKNxGx4tatNx/mYE9EBldVrgZ30TuH3ov8bqjD8wlQxaGBMV2nXK6X2EX1lPZ9lENLc8aJLkY/dLPC5Czsq4O9MES/yERXeyxh8Hxt4y2uDt3NC1o5hlAlphHBKHw+I+hZjUwGGvUv9LFj6NQyX7lgIIJ+x7hO+oCkonZI3Mjd7jGi/+OunoHzVxRg63CeBgduPLc0kvHctUQdKpnNLyJw6CNO4cc+KU1qOYIrq7Jvb5Y953Leb4lpMS6SbzuZfXrIlVjYbfRfe80jhQletrGBd2F7SUS+SFUWyFvFU2n89iysZIN8VZuXAf5sHX9f2qvbeunVCQw8sKvWt6Wk2JgRFdQ6asA+eG5Lrb3DK4fZus648tsinBzuzGp8vHya/EFlK3T8UTAy6XhiVwoAMOKUyuF318PhRqJYC4m8vy2+WeKOdkTQCS5F9d+ZHkCu3H/5OrGVslxNWTiCGZEJhuiWfdLRyOd0pyXXSmBIvAI1ZW/PWA+wA57L9KIv/E7SxIq6F0/sv0yWNbZZWgQk/Ql9S3PhvPbV86zOOlknUxNuFxbh/T/BVBNjfDezMowaAF2XjoJ/wxuS4yUws4KVyE4AXKaJvNchxn+Nsy53pb+p45sr+hQzrpXH6KEx3/MZJ1m6etXdJf3/4heO+9bJo9uxbGVqF934V1riPkHeIi/+TAtP8PBXOKLsn7O5Vvr59yto2tlZgAwT2FR5bTo4yxorAEI9xhtY+y3Us452cNEiCrf6923vvGrf0fnK9fQtwt3u0CFXrlrEFuGR5RMVzo0oJccJUh4E84+Culjj6SXo8tl6veBGZEO0vEiIr+rlg5/NLB3qaOz3Ef/LVoPZoAw+ndkqYqC8p+PuVlKo21vySN8QkWdzErljSS/AnTbvplkLh6nmtBxEERP44Sd9G+cOmhFyTAeJX3J/h5wyXVuP401sX9Gb+Hs5YDOCr/AiEuAtbb8PkrJNvBf0qkywR/xxVpEy1WLekExHTE5q8fbulcm8mHzaL6NH8zxg0E9fcw9frS+6qS7ikjV1nft7WnFKIoJ5XNLs37Lo/txJDaIGHiIRkOYs980tlEesXBLcOvIArxvPFf708nSmGXvrMmDx2yrph+krboeqjnJS22PT6r20pH4UtzAiKKo1grB4q50K5j+5XwTw8td/DztJZoh+sLcguhGkRsgWq9TDom9o5/OImio1ByBc4QgOJ8YTb5s0hu7tJlhL6iiCIbeWxMFEjjrLhFiNRRkC5COLsggUlhqhmjW/g+9lvmn+lQrKRqCbVJporaCu1sgwp5R5RYnOVMzozxKipCupLGcnX0aqPLGYyM5XzbHg2QsI0E1WdYOjd+kR38YdYop6iHUEfHRUsygRQGRmPlXVYvz5MV6Tdvu1Y1jJRw8aTjWTC4Usv5iZDPc3ZO3qUIeC4euhF2WCrjgg2K+Ozc3MDzpR80dI/zcnXjYPfu/wsb5XdpCQeRggAAAABJRU5ErkJggg==" style="position:absolute;top:-4px;right:-4px;width:62px;height:62px;mix-blend-mode:multiply;background:#fff"/>
            </div>
          <div style="height:1em"></div>
          <div>担当：${staff}</div>
          <div>TEL：03-5777-1100</div>
          <div>MAIL：invoice@olq.co.jp</div>
        </div>
        </div>
        <!-- 左下: 挨拶文・ご請求金額 -->
        <div style="grid-column:1;grid-row:2;padding-top:4em">
          <div style="font-size:10px;margin-bottom:4px">毎度ありがとうございます。下記の通りご請求申し上げます。</div>
          <div style="display:flex;align-items:baseline;gap:14px">
            <span style="font-size:12px;font-weight:bold">ご請求金額</span>
            <span style="font-size:18px;font-weight:bold;border-bottom:2px solid #111;padding:0 8px">${fm(grandTot+taxAmt)}</span>
            <span style="font-size:10px">（税込）</span>
          </div>
        </div>
      </div>
      <!-- 明細テーブル -->
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;white-space:nowrap">ご利用日</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:40px">日数</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:70px">ご発注者</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center">製品名</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:36px">台数</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:72px">単価</th>
            <th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:80px">金額</th>
          </tr>
        </thead>
        <tbody>`;
    g.items.forEach(r => {
      const days = r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.billingDays||r.days||0);
      const orderer = r.ordererName ? r.ordererName+"　様" : "";
      const rLines = (r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,quantity:r.quantity,unitPrice:r.unitPrice,amount:r.amount,lineNote:r.lineNote||""}];
      const lineCount = rLines.length;
      rLines.forEach((ln,li)=>{
        const lineAmt = ln.amount!==undefined ? ln.amount : Math.round((ln.unitPrice||0)*(ln.quantity||1)*(r.billingType==="monthly"?(r.months||1):(r.billingDays||r.days||1)));
        const equipName = ln.equipmentName||r.equipmentName||"";
        const nameExtra = li===0?(r.projectDetail?`<span style="color:#555;font-size:10px">　[${r.projectDetail}]</span>`:""):"";
        body += `<tr>
          ${li===0?`<td style="border:1px solid #aaa;padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:top" rowspan="${lineCount}">${fd(r.startDate)}〜${fd(r.endDate)}${r.billingType==="monthly"?'<div style="font-size:10px;margin-top:2px">[月極]</div>':""}${r.ecOrderNo?`<div style="font-size:10px;margin-top:2px">${r.ecOrderNo}</div>`:""}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:top" rowspan="${lineCount}">${days}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:top" rowspan="${lineCount}">${orderer}</td>`:""}
          <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${equipName}${nameExtra}</td>
          <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${ln.quantity||1}</td>
          <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(ln.unitPrice||r.unitPrice)}</td>
          <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(lineAmt)}</td>
        </tr>`;
      });
    });
    // 補償料行
    if(totIns>0){
      body += `<tr style="background:#fff7ed">
        <td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right;color:#92400e">補償料（機材合計の10%）</td>
        <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;color:#92400e;font-weight:bold">${fn(totIns)}</td>
      </tr>`;
    }
    // 調整行
    adjustments.filter(a=>a.label||a.amount).forEach(a=>{
      body += `<tr style="background:#fefce8">
        <td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right;color:#92400e">${a.label||"調整"}</td>
        <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:bold;color:${Number(a.amount)<0?"#dc2626":"#16a34a"}">${fn(Number(a.amount)||0)}</td>
      </tr>`;
    });
    const pcH = g.customer?.paymentCycle||"";
    const [myH,mmH] = (g.month||"").split("-").map(Number);
    let dueStrH = "";
    if(myH&&mmH&&pcH&&pcH!=="スクエア"&&pcH!=="その他"){
      let addMH=0, dayValH=0;
      if(pcH.includes("翌月")) addMH=1; else if(pcH.includes("翌々月")) addMH=2;
      const m2H=(mmH-1+addMH)%12+1, y2H=myH+Math.floor((mmH-1+addMH)/12);
      if(pcH.endsWith("末日")){ dayValH=new Date(y2H,m2H,0).getDate(); }
      else { const nH=parseInt((pcH.match(/[0-9]+日/)||[])[0])||0; dayValH=nH; }
      if(dayValH) dueStrH = y2H+"年"+m2H+"月"+dayValH+"日";
    }
    const dueHtml = dueStrH ? `<div>お支払い期日：<span style="color:#c00;font-weight:bold">${dueStrH}</span></div>` : "";
    const pcHtml = pcH&&pcH!=="スクエア"&&pcH!=="その他" ? `<div>お支払い条件：${pcH}</div>` : "";
    body += `</tbody>
        <tfoot>
          <tr>
            <td colspan="4" rowspan="3" style="border:1px solid #aaa;padding:6px 10px;vertical-align:middle;font-size:8px;line-height:1.8;text-align:center">
              <div style="display:inline-flex;gap:24px;text-align:left">
                <div>
                  <div style="font-weight:bold;margin-bottom:2px">お振込先</div>
                  <div>みずほ銀行　新橋中央支店　店番号　051</div>
                  <div>普通口座　2333044</div>
                  <div>口座名義　オルク株式会社</div>
                </div>
                <div style="padding-top:2em">
                  ${pcHtml}${dueHtml}
                  <div>※振込み手数料はご負担願います。</div>
                </div>
              </div>
            </td>
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center;background:#f0f0f0">小計[10%対象]</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center;background:#f0f0f0">${fn(grandTot)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center">消費税[10%]</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center">${fn(taxAmt)}</td>
          </tr>
          <tr style="background:#f0f0f0">
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center">税込合計</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center">${fn(grandTot+taxAmt)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  } else {
    // 納品書HTML（各案件 → 納品書1ページ + 控え1ページ）
    g.items.forEach((r, idx) => {
      const no = genDeliveryNo(r, idx);
      const lines = (r.lines && r.lines.length) ? r.lines : [{equipmentName:r.equipmentName,equipNo:r.equipNo,unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[]}];
      const projText = r.projectName || g.projectName || "";
      const orderer = r.ordererName || g.customer?.contact || "";
      const honorific = orderer ? "　様" : "";
      const staff = r.ourStaff || "―";

      const olqBlock = `<div class="olq"><div style="font-weight:bold;font-size:12px">オルク株式会社</div>
        <div>担当　<strong>${staff}</strong></div><div>〒105-0004</div>
        <div>東京都港区新橋6-10-2</div><div>第二新洋ビル 1F</div>
        <div>TEL: 03-5777-1100</div><div>FAX: 03-5777-1101</div></div>`;

      // 納品書（お客様用）
      const showDPrice = !!g.customer?.showDeliveryPrice;
      body += `<div class="pb" style="padding:30px 34px">
        <div style="display:flex;justify-content:space-between"><div class="title">納 品 書</div>
          <div class="olq"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.startDate)}</div></div></div>
        <div class="hdr"><div>
          <div class="cust-name">${g.customer?.invoiceName||g.customerName}　${orderer?"御中":"様"}</div>
          ${projText?`<div style="margin-top:4px">『${projText}』</div>`:""}
          ${orderer?`${orderer?`<div style="margin-top:3px">${orderer}　様</div>`:""}`:""}
          ${r.ecOrderNo?`<div style="margin-top:2px;font-size:10px">EC注文番号：${r.ecOrderNo}</div>`:""}
        </div>${olqBlock}</div>
        <div style="font-size:10px;color:#444;margin-bottom:10px">毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</div>
        <table><thead><tr><th style="width:30px">No.</th><th>機材名</th>${showDPrice?`<th style="width:60px">単価</th>`:""}
          <th style="width:40px">数量</th><th style="width:80px">開始日</th><th style="width:80px">終了日</th><th>備考</th></tr></thead><tbody>`;
      let rowN = 0;
      lines.forEach(ln => { rowN++;
        body += `<tr><td class="c">${rowN}</td><td>${ln.equipmentName||""}</td>${showDPrice?`<td class="r">${fm(ln.unitPrice||0)}</td>`:""}<td class="c">${ln.quantity||""}</td><td class="c">${fd(r.startDate)}</td><td class="c">${fd(r.endDate)}</td><td style="font-size:10px">${r.billingType==="monthly"?("月極"+(ln.lineNote?" "+ln.lineNote:"")):(ln.lineNote||"")}</td></tr>`;
        (ln.subItems||[]).forEach(si => { rowN++;
          body += `<tr class="sub-row"><td></td><td style="padding-left:16px">└ No.${si.no}</td>${showDPrice?`<td></td>`:""}<td></td><td></td><td></td><td style="font-size:9px">${si.note||""}</td></tr>`;
        });
      });
      const emptyCols = showDPrice ? `<td></td><td></td><td></td><td></td><td></td><td></td>` : `<td></td><td></td><td></td><td></td><td></td>`;
      for (let i = rowN; i < 20; i++) body += `<tr class="empty"><td class="c" style="color:#ccc">${i+1}</td>${emptyCols}</tr>`;
      body += `</tbody></table>
        <table style="margin-top:-1px"><tr><td class="biko">備　考</td><td style="min-height:90px;white-space:pre-wrap">${r.notes||""}</td></tr></table>
        <div class="note">
          <div><strong>※ご利用前に、必ず内容物確認と動作チェックを行なってください。</strong></div>
        </div></div>`;

      // 納品書控（社内用）
      body += `<div class="pb" style="padding:30px 34px">
        <div style="display:flex;justify-content:space-between"><div class="title" style="letter-spacing:4px">納品書控</div>
          <div class="olq"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.startDate)}</div></div></div>
        <div class="hdr"><div>
          <div class="cust-name">${g.customer?.invoiceName||g.customerName}　${orderer?"御中":"様"}</div>
          ${projText?`<div style="margin-top:4px">『${projText}』</div>`:""}
          ${orderer?`<div style="margin-top:3px">${orderer}　様</div>`:""}
          ${r.ecOrderNo?`<div style="margin-top:2px;font-size:10px">EC注文番号：${r.ecOrderNo}</div>`:""}
          <div style="display:flex;gap:14px;margin-top:12px">
            <div class="sign-box"><div class="sign-label">納品確認</div><div class="sign-date">Date　　　　／</div><div style="min-height:32px"></div></div>
            <div class="sign-box"><div class="sign-label">返却確認</div><div class="sign-date">Date　　　　／</div><div style="min-height:32px"></div></div>
          </div>
        </div>${olqBlock}</div>
        <table style="margin-top:10px"><thead><tr><th style="width:30px">No.</th><th>機材名</th><th style="width:36px">No</th><th style="width:54px">単価</th><th style="width:36px">数量</th><th style="width:72px">開始日</th><th style="width:72px">終了日</th><th>備考</th></tr></thead><tbody>`;
      rowN = 0;
      lines.forEach(ln => { rowN++;
        body += `<tr><td class="c">${rowN}</td><td>${ln.equipmentName||""}</td><td class="c">${ln.equipNo||""}</td><td class="r">${fm(ln.unitPrice)}</td><td class="c">${ln.quantity||""}</td><td class="c">${fd(r.startDate)}</td><td class="c">${fd(r.endDate)}</td><td style="font-size:10px">${r.billingType==="monthly"?("月極"+(ln.lineNote?" "+ln.lineNote:"")):(ln.lineNote||"")}</td></tr>`;
        (ln.subItems||[]).forEach(si => { rowN++;
          body += `<tr class="sub-row"><td></td><td style="padding-left:14px">└ ${ln.equipmentName||""}</td><td class="c" style="font-size:10px">${si.no}</td><td></td><td></td><td></td><td></td><td style="font-size:9px">${si.note||""}</td></tr>`;
        });
      });
      for (let i = rowN; i < 20; i++) body += `<tr class="empty"><td class="c" style="color:#ccc">${i+1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
      body += `</tbody></table>
        <table style="margin-top:-1px"><tr><td class="biko">備　考</td><td style="min-height:90px;white-space:pre-wrap">${r.notes||""}</td></tr></table></div>`;

      // 領収証ページ（delivery-receipt かつ issueReceipt=true の案件のみ）
      if (type === "delivery-receipt" && r.issueReceipt) {
        const rIdx = g.items.indexOf(r);
        const receiptNo = genDeliveryNo(r, rIdx);
        const receiptDateStr = r.receiptDate ? new Date(r.receiptDate).toLocaleDateString("ja-JP") : fd(r.startDate);
        const payLabel = r.paymentMethod === "cash" ? "現金" : "クレジット　スクエア";
        const receiptName = r.ordererName || g.customer?.contact || g.customer?.invoiceName || g.customerName;
        const subTot = Math.round(r.amount / 1.1);
        const tax = r.amount - subTot;

        body += `<div class="pb" style="padding:36px 40px;font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#111">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div class="title" style="letter-spacing:8px">領 収 証</div>
            <div style="text-align:right;font-size:10px;line-height:2">
              <div>領収証No.　<strong style="font-size:12px">${receiptNo}</strong></div>
              <div>登録番号　T5-0104-0109-2630</div>
              <div>領収日　${receiptDateStr}</div>
              <div style="font-weight:700;font-size:11px;margin-top:4px">オルク株式会社</div>
              <div style="position:relative;display:inline-block;text-align:right">
                <div>〒105-0004</div>
                <div>東京都港区新橋6-10-2</div>
                <div>第二新洋ビル 1F</div>
                <div>TEL：03-5777-1100</div>
                <div>FAX：03-5777-1101</div>
                <img src="data:image/png;base64,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" style="position:absolute;top:-8px;right:-6px;width:62px;height:62px;opacity:.9;pointer-events:none"/>
              </div>
            </div>
          </div>
          <div style="font-size:18px;font-weight:700;border-bottom:2px solid #111;padding-bottom:4px;display:inline-block;min-width:240px;margin-bottom:16px">${receiptName}　様</div>
          <div style="margin-bottom:8px;font-size:13px">
            <span style="margin-right:16px">合計金額</span>
            <span style="font-size:28px;font-weight:900;border-bottom:2px solid #111;padding:0 20px">${fm(r.amount)}</span>
            <span style="font-size:13px;margin-left:8px">（税込）</span>
          </div>
          <div style="margin-bottom:12px;font-size:12px">上記、正に領収いたしました。</div>
          <div style="font-size:11px;margin-bottom:16px;border:1px solid #ddd;border-radius:4px;padding:8px 12px;background:#f9f9f9">
            但書き　機材レンタル代として　［${payLabel}］
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center">ご利用日</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center;width:40px">日数</th>
                <th style="border:1px solid #aaa;padding:4px 6px">製品名</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center;width:36px">数量</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:right;width:64px">単価</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:right;width:72px">金額</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(ln=>{
                const noDisc = ln.noBillingDiscount;
                const useDays = r.billingType==="monthly"?(r.months||1):(noDisc?(r.days||0):(r.billingDays||r.days||0));
                const lineAmt = Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDays);
                const daysLabel = r.billingType==="monthly"?`${r.months||1}ヶ月`:`${useDays}日`;
                return `<tr>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:center">${fd(r.startDate)}〜${fd(r.endDate)}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:center">${daysLabel}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px">${ln.equipmentName||""}</td>
                  <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${ln.quantity||1}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fm(ln.unitPrice)}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fn(lineAmt)}</td>
                </tr>`;
              }).join("")}
              ${(r.insuranceAmount||0)>0?`<tr style="background:#fff7ed">
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right;color:#92400e;font-weight:700">補償料（機材合計の10%）</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;color:#92400e;font-weight:700">${fm(r.insuranceAmount)}</td>
              </tr>`:""}
            </tbody>
            <tfoot>
              <tr style="background:#f9f9f9">
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right;font-weight:700">小計 [10%対象]</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:700">${fm(subTot)}</td>
              </tr>
              <tr>
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right">消費税 [10%]</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fm(tax)}</td>
              </tr>
              <tr style="background:#fff7e6">
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right;font-weight:900;font-size:12px">税込合計</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:900;font-size:12px">${fm(r.amount)}</td>
              </tr>
            </tfoot>
          </table>

        </div>`;
      }
    });
  }

  const fullHTML = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title><style>
${css}
@media print { .no-print { display:none!important; } body { margin:0; } }
</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)">
  <span style="font-weight:700;flex:1">${title}</span>
  <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer">🖨 印刷 / PDF保存</button>
  <button onclick="window.close()" style="background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer">✕ 閉じる</button>
</div>
<div style="margin-top:52px">${body}</div>
</body></html>`;
  // アーティファクト環境ではwindow.openがブロックされるため、aタグDLで対応
  const blob = new Blob([fullHTML], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// =========================================================
// DeliveryTab（納品書タブ）
// =========================================================
function DeliveryTab({records, customers, groups, showToast, globalQ}){
  const [fil, setFil] = useState({q:"", cid:"", month:""});
  const [preview, setPreview] = useState(null); // {type, g}

  const mnths=[...new Set(records.map(r=>r.startDate?.slice(0,7)))].filter(Boolean).sort().reverse();

  // 案件ごとに単独グループを作成してdownloadに渡す
  const makeGroup = (r) => {
    const c = customers.find(x=>x.id===r.customerId);
    return {
      customerId: r.customerId,
      customer: c||null,
      customerName: c?.name||"不明",
      projectName: r.projectName||"",
      month: r.startDate?.slice(0,7)||"",
      items: [r],
      split: true,
      consolidate: false,
    };
  };

  const filtered = records.filter(r=>{
    const q=fil.q.toLowerCase(), c=customers.find(x=>x.id===r.customerId);
    const gq=(globalQ||"").toLowerCase();
    const rLns=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName||""}];
    const matchQ=!q||c?.name?.toLowerCase().includes(q)||r.projectName?.toLowerCase().includes(q)||rLns.some(ln=>(ln.equipmentName||"").toLowerCase().includes(q))||(r.deliveryNo||"").toLowerCase().includes(q);
    const matchGQ=!gq||c?.name?.toLowerCase().includes(gq)||r.projectName?.toLowerCase().includes(gq)||rLns.some(ln=>(ln.equipmentName||"").toLowerCase().includes(gq));
    return matchQ&&matchGQ&&(!fil.cid||r.customerId===fil.cid)&&(!fil.month||r.startDate?.startsWith(fil.month));
  });

  const previewG = preview ? makeGroup(preview.r) : null;

  return(
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>
        <h2 style={{fontSize:16,fontWeight:700,marginBottom:14}}>納品書</h2>
        <div style={S.card}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1,minWidth:180,position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={fil.q} onChange={e=>setFil(f=>({...f,q:e.target.value}))} placeholder="会社・製品・案件名で検索..." style={{...S.inp,paddingLeft:28}}/>
            </div>
            <select value={fil.cid} onChange={e=>setFil(f=>({...f,cid:e.target.value}))} style={{...S.inp,width:170}}>
              <option value="">全顧客</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={fil.month} onChange={e=>setFil(f=>({...f,month:e.target.value}))} style={{...S.inp,width:125}}>
              <option value="">全期間</option>
              {mnths.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
              <thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                {["顧客","案件名","機材","利用期間","金額(税抜)",""].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.length===0
                  ?<tr><td colSpan={6} style={{padding:48,textAlign:"center",color:"#94a3b8"}}>案件がありません</td></tr>
                  :filtered.map((r,i)=>{
                    const c=customers.find(x=>x.id===r.customerId);
                    const isActive=preview?.r?.id===r.id;
                    const g=makeGroup(r);
                    return(
                      <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9",background:isActive?"#f0fdf4":i%2?"#fcfcfc":"#fff",cursor:"pointer"}}
                        onClick={()=>setPreview(prev=>prev?.r?.id===r.id?null:{r, type:r.issueReceipt?"delivery-receipt":"delivery"})}>
                        <td style={{padding:"8px 12px",fontWeight:600}}>{c?.name||"―"}</td>
                        <td style={{padding:"8px 12px",fontSize:11,color:"#64748b"}}>
                          {r.projectName||"―"}
                          {r.ecOrderNo&&<span style={{marginLeft:6,fontSize:10,color:"#0369a1"}}>EC:{r.ecOrderNo}</span>}
                        </td>
                        <td style={{padding:"8px 12px",fontSize:11}}>{r.equipmentName}</td>
                        <td style={{padding:"8px 12px",fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                        <td style={{padding:"8px 12px",fontWeight:700,color:"#16a34a"}}>{fmt(r.amount)}</td>
                        <td style={{padding:"8px 12px",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery", g)} style={{...S.ib("#16a34a"),fontSize:11}}>
                            <Ico d={I.file} size={11}/>{r.issueReceipt?"納品書・領収証":"納品書"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {preview&&previewG&&(
        <div style={{flex:1,minWidth:0,position:"sticky",top:70}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#475569",display:"flex",alignItems:"center",gap:6}}>
              <Ico d={I.file} size={14} color="#16a34a"/>
              {preview.type==="delivery-receipt"?"納品書・領収証":"納品書"} プレビュー
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>downloadPrintHTML(preview.type,previewG)} style={{...S.btn("#16a34a",true),fontSize:11}}>🖨 印刷・PDF</button>
              <button onClick={()=>setPreview(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Ico d={I.x} size={16} color="#94a3b8"/></button>
            </div>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",marginBottom:6}}>💡 「印刷・PDF」でHTMLファイルをダウンロードします</div>
          <div style={{...S.card,maxHeight:"calc(100vh - 160px)",overflowY:"auto",border:"2px solid #bbf7d0"}}>
            <InvoicePreview type={preview.type} g={previewG}/>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// InvoiceTab（請求書タブ） — 月選択・ステータス管理・調整行
// =========================================================
function InvoiceTab({groups, customers, onSaveCust, invoiceData, onSaveInv, showToast, globalQ, records}){
  const months = [...new Set(groups.map(g=>g.month).filter(Boolean))].sort().reverse();
  const currentMonth = today().slice(0,7);
  const [selMonth, setSelMonth] = useState(months.includes(currentMonth)?currentMonth:(months[0]||""));
  // groupsが変化したときにselMonthを補正
  React.useEffect(()=>{
    if(months.length>0 && !selMonth){
      setSelMonth(months.includes(currentMonth)?currentMonth:months[0]);
    }
  },[months.length]);
  const [preview, setPreview] = useState(null);
  const [expanded, setExpanded] = useState({}); // {key: bool}
  const [statusFilter, setStatusFilter] = useState("all"); // "all"|"open"|"locked"
  const [showPwSetting, setShowPwSetting] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [custQ, setCustQ] = useState("");

  const getInvData = (key, month) => {
    const d = invoiceData[key] || {};
    if(!d.issueDate && month) {
      // デフォルト: 月末日
      const [y,m] = (month||"").split("-").map(Number);
      const lastDay = y&&m ? new Date(y, m, 0).getDate() : null;
      d.issueDate = y&&m ? `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}` : "";
    }
    return {status:"open", adjustments:[], issueDate:"", ...d};
  };
  const updateInvData = async (key, patch) => {
    const next = {...invoiceData, [key]:{...getInvData(key),...patch}};
    await onSaveInv(next);
  };
  const addAdj = async (key) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:[...d.adjustments, {id:uid(), label:"", amount:0}]});
  };
  const updateAdj = async (key, adjId, patch) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.map(a=>a.id===adjId?{...a,...patch}:a)});
  };
  const removeAdj = async (key, adjId) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.filter(a=>a.id!==adjId)});
  };
  const toggleLock = async (key, e) => {
    e.stopPropagation();
    const d = getInvData(key);
    if(d.status==="locked"){
      const pw = prompt("締め済みを解除するにはパスワードを入力してください。");
      if(pw===null)return;
      const ok = await verifyPw(pw);
      if(!ok){alert("パスワードが違います");return;}
      await updateInvData(key, {status:"open"});
      showToast("締めを解除しました");
    } else {
      if(!window.confirm("この月を締め済みにしますか？\n解除にはパスワードが必要になります。"))return;
      await updateInvData(key, {status:"locked"});
      showToast("締め済みにしました 🔒");
    }
  };
  const toggleExpand = (key) => setExpanded(p=>({...p,[key]:!p[key]}));

  const filtered = groups
    .filter(g=>!selMonth||g.month===selMonth)
    .filter(g=>(!custQ||g.customerName.toLowerCase().includes(custQ.toLowerCase()))&&(!globalQ||g.customerName.toLowerCase().includes(globalQ.toLowerCase())||g.projectName?.toLowerCase().includes(globalQ.toLowerCase())))
    .filter(g=>{
      if(statusFilter==="all") return true;
      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`);
      return statusFilter==="locked"?d.status==="locked":d.status!=="locked";
    })
    .sort((a,b)=>a.customerName.localeCompare(b.customerName,"ja")||a.projectName.localeCompare(b.projectName,"ja"));

  const monthTotal = filtered.reduce((s,g)=>{
    const key=`${g.customerId}||${g.projectName}||${g.month}`;
    const d=getInvData(key,g.month);
    const base=g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
    const adj=d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    return s+base+adj;
  },0);

  return(
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>

        {/* ヘッダー */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h2 style={{fontSize:16,fontWeight:700,margin:0}}>請求書</h2>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {/* 月選択 */}
            <select value={selMonth} onChange={e=>{setSelMonth(e.target.value);setExpanded({});setPreview(null);}}
              style={{...S.inp,width:125,fontWeight:700,fontSize:13}}>
              <option value="">全期間</option>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {/* 顧客検索 */}
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={custQ} onChange={e=>setCustQ(e.target.value)} placeholder="顧客名で絞り込み"
                style={{...S.inp,paddingLeft:26,width:150}}/>
            </div>
            {/* ステータスフィルター */}
            <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
              {[{k:"all",l:"全て"},{k:"open",l:"未締め"},{k:"locked",l:"締め済み"}].map(t=>(
                <button key={t.k} onClick={()=>setStatusFilter(t.k)} style={{
                  background:statusFilter===t.k?"#fff":"transparent",border:"none",borderRadius:5,
                  padding:"4px 10px",fontSize:11,fontWeight:statusFilter===t.k?700:500,
                  color:statusFilter===t.k?"#0f172a":"#94a3b8",cursor:"pointer",
                  boxShadow:statusFilter===t.k?"0 1px 3px rgba(0,0,0,.1)":"none"
                }}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 月合計バー */}
        {/* 統計カード */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
          {[
            {l:"今月の案件数",v:(records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).length+"件",c:"#2563eb"},
            {l:"今月売上(税抜)",v:fmt((records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).reduce((s,r)=>s+(r.amount||0),0)),c:"#16a34a"},
            {l:"顧客数",v:new Set((records||[]).map(r=>r.customerId)).size+"社",c:"#9333ea"}
          ].map(s=>(
            <div key={s.l} style={{...S.card,padding:"16px 20px"}}><div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{s.l}</div><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div></div>
          ))}
        </div>
        {/* パスワード設定 */}
        {showPwSetting&&(
          <div style={{...S.card,padding:"12px 16px",marginBottom:10,background:"#fefce8",border:"1px solid #fde047"}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔑 締め解除パスワードの変更</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="新しいパスワード" style={{...S.inp,width:180}}/>
              <button onClick={async()=>{if(!newPw){alert("パスワードを入力してください");return;}const cur=prompt("現在のパスワードを入力");const ok=await verifyPw(cur);if(!ok){alert("現在のパスワードが違います");return;}await updateLockPw(newPw);setNewPw("");setShowPwSetting(false);showToast("パスワードを変更しました");}} style={S.btn("#0f172a",true)}>変更</button>
              <button onClick={()=>{setShowPwSetting(false);setNewPw("");}} style={S.btn("#94a3b8")}>キャンセル</button>
            </div>
          </div>
        )}
        {selMonth&&filtered.length>0&&(
          <div style={{background:"#eff6ff",borderRadius:8,padding:"8px 16px",marginBottom:10,display:"flex",gap:20,fontSize:12,alignItems:"center"}}>
            <span style={{color:"#64748b"}}>{selMonth}　{filtered.length}件</span>
            <span><span style={{color:"#64748b"}}>税抜合計: </span><strong style={{color:"#16a34a",fontSize:15}}>{fmt(monthTotal)}</strong></span>
            <span><span style={{color:"#64748b"}}>消費税: </span>{fmt(Math.round(monthTotal*0.1))}</span>
            <span><strong style={{color:"#9333ea",fontSize:15}}>{fmt(monthTotal+Math.round(monthTotal*0.1))}</strong><span style={{color:"#64748b"}}>（税込）</span></span>
            <button onClick={()=>setShowPwSetting(p=>!p)} style={{...S.btn("#f59e0b",true),fontSize:11}}>🔑 PW設定</button>
            <button onClick={()=>{
              // freee 取引インポートCSV出力
              const [y,m] = selMonth.split("-").map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              const dateStr = `${y}/${String(m).padStart(2,"0")}/${String(lastDay).padStart(2,"0")}`;
              const bom = "\uFEFF"; const rows = [bom+"発生日,金額,取引先,勘定科目,税区分,摘要"];
              filtered.forEach(g=>{
                const base = g.items.reduce((s,r)=>s+(Number(r.amount)||0),0);
                const tax = Math.round(base*0.1);
                const total = base + tax;
                const memo = [g.customerName, g.projectName].filter(Boolean).join(" / ");
                rows.push([dateStr, total, g.customerName, "売上高", "課税売上10%", memo].join(","));
              });
              const blob = new Blob([rows.join("\r\n")], {type:"text/csv;charset=utf-8"});
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = `freee_取引_${selMonth}.csv`;
              a.click();
            }} style={{...S.btn("#0ea5e9",true),fontSize:11,marginLeft:"auto"}}>📤 freee CSV</button>
          </div>
        )}

        {/* テーブル */}
        <div style={S.card}>
          {filtered.length===0
            ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              {selMonth?"この月の請求データがありません":"案件を登録すると表示されます"}
            </div>
            :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569",width:20}}></th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>顧客</th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>案件名</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:40}}>件数</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税抜</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税込</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:90}}>状態</th>
                  <th style={{padding:"8px 12px",width:80}}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g,i)=>{
                  const key=`${g.customerId}||${g.projectName}||${g.month}`;
                  const d=getInvData(key,g.month);
                  const locked=d.status==="locked";
                  const baseTot=g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
                  const adjSum=d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
                  const grandTot=baseTot+adjSum;
                  const tax=Math.round(grandTot*0.1);
                  const isOpen=!!expanded[key];
                  const isActive=preview?.key===key;

                  return(
                    <React.Fragment key={key}>
                      {/* サマリー行 */}
                      <tr onClick={()=>toggleExpand(key)} style={{
                        borderBottom:isOpen?"none":"1px solid #f1f5f9",
                        background:locked?"#f0fdf4":isActive?"#eff6ff":i%2?"#fcfcfc":"#fff",
                        cursor:"pointer",transition:"background .15s"
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background=locked?"#dcfce7":"#e8f4ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=locked?"#f0fdf4":isActive?"#eff6ff":i%2?"#fcfcfc":"#fff"}
                      >
                        <td style={{padding:"8px 12px",textAlign:"center",color:"#94a3b8",fontSize:11}}>
                          {isOpen?"▼":"▶"}
                        </td>
                        <td style={{padding:"8px 12px",fontWeight:600}}>{g.customerName}</td>
                        <td style={{padding:"8px 12px",color:"#64748b",fontSize:11}}>
                          {g.projectName
                            ?<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:600}}>{g.projectName}</span>
                            :<span style={{color:"#cbd5e1"}}>―</span>
                          }
                          {d.adjustments.length>0&&<span style={{marginLeft:6,fontSize:10,color:"#92400e"}}>調整あり</span>}
                        </td>
                        <td style={{padding:"8px 12px",textAlign:"center",color:"#64748b"}}>{g.items.length}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(grandTot)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:"#9333ea"}}>{fmt(grandTot+tax)}</td>
                        <td style={{padding:"8px 12px",textAlign:"center"}} onClick={e=>toggleLock(key,e)}>
                          <span style={{
                            background:locked?"#dcfce7":"#f1f5f9",
                            color:locked?"#15803d":"#64748b",
                            border:`1px solid ${locked?"#86efac":"#e2e8f0"}`,
                            borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,
                            cursor:"pointer",whiteSpace:"nowrap"
                          }}>{locked?"✅ 締め済み":"未締め"}</span>
                        </td>
                        <td style={{padding:"8px 8px",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setPreview(p=>p?.key===key?null:{key,g})}
                            style={{...S.ib(isActive?"#1d4ed8":"#94a3b8"),fontSize:10,padding:"2px 6px",marginRight:3}}>
                            <Ico d={I.print} size={10}/>確認
                          </button>
                          <button onClick={async()=>{
                            // 最新のinvoiceDataから取得
                            const cur = getInvData(key);
                            let baseNo = cur.invNo;
                            let count;
                            if(!baseNo){
                              // 初回発行: 番号を採番
                              baseNo = await nextInvoiceNo(g.month);
                              count = 1;
                            } else {
                              // 再発行: カウントを増やす
                              count = (cur.printCount||1) + 1;
                            }
                            await updateInvData(key, {invNo:baseNo, printCount:count});
                            const invNo = count <= 1 ? baseNo : `${baseNo}-${count}`;
                            downloadPrintHTML("invoice",{...g,adjustments:cur.adjustments,invNo,issueDate:cur.issueDate||""});
                          }} style={{...S.ib("#1d4ed8"),fontSize:10,padding:"2px 6px"}}>
                            🖨
                          </button>
                        </td>
                      </tr>

                      {/* 展開行 */}
                      {isOpen&&(
                        <tr>
                          <td colSpan={8} style={{padding:0,borderBottom:"1px solid #e2e8f0"}}>
                            <div style={{background:"#f8fafc",padding:"12px 16px 12px 48px"}}>
                              {/* 発行日 */}
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                <span style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>発行日：</span>
                                <input type="date" value={d.issueDate||""} onChange={e=>updateInvData(key,{issueDate:e.target.value})}
                                  style={{...S.inp,width:140,fontSize:11,padding:"3px 8px"}} disabled={locked}/>
                                <span style={{fontSize:10,color:"#94a3b8"}}>（デフォルト: 月末日）</span>
                              </div>
                              {/* 案件リスト */}
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
                                <thead>
                                  <tr style={{color:"#94a3b8",borderBottom:"1px solid #e2e8f0"}}>
                                    <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>機材</th>
                                    <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>利用期間</th>
                                    <th style={{padding:"3px 8px",textAlign:"center",fontWeight:600,width:50}}>日数</th>
                                    <th style={{padding:"3px 8px",textAlign:"right",fontWeight:600,width:80}}>金額（税抜）</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.items.map(r=>(
                                    <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                                      <td style={{padding:"4px 8px",color:"#475569"}}>
                                        {r.equipmentName}
                                        {r.projectDetail&&<span style={{color:"#94a3b8",marginLeft:4}}>({r.projectDetail})</span>}
                                        {r.ecOrderNo&&<span style={{color:"#0369a1",marginLeft:4,fontSize:10}}>EC:{r.ecOrderNo}</span>}
                                      </td>
                                      <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                                      <td style={{padding:"4px 8px",textAlign:"center",color:"#64748b"}}>
                                        {r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.billingDays||r.days||0)}
                                      </td>
                                      <td style={{padding:"4px 8px",textAlign:"right",fontWeight:600,color:"#16a34a"}}>{fmt(r.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {/* 調整行 */}
                              <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:6,padding:"8px 12px"}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <span>調整行</span>
                                  {!locked&&<button onClick={()=>addAdj(key)} style={{...S.ib("#92400e"),fontSize:10,padding:"2px 8px"}}>
                                    <Ico d={I.plus} size={11}/>追加
                                  </button>}
                                </div>
                                {d.adjustments.length===0&&<div style={{fontSize:11,color:"#94a3b8"}}>調整行なし</div>}
                                {d.adjustments.map(a=>(
                                  <div key={a.id} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                                    <input value={a.label} onChange={e=>updateAdj(key,a.id,{label:e.target.value})}
                                      placeholder="内容（例: 値引き）" style={{...S.inp,flex:1,fontSize:11,padding:"4px 8px"}} disabled={locked}/>
                                    <input type="number" value={a.amount} onChange={e=>updateAdj(key,a.id,{amount:Number(e.target.value)})}
                                      style={{...S.inp,width:110,fontSize:11,padding:"4px 8px",textAlign:"right"}} disabled={locked}/>
                                    <span style={{fontSize:11,color:Number(a.amount)<0?"#dc2626":"#16a34a",minWidth:64,textAlign:"right"}}>{fmt(Number(a.amount)||0)}</span>
                                    {!locked&&<button onClick={()=>removeAdj(key,a.id)} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={12} color="#ef4444"/></button>}
                                  </div>
                                ))}
                              </div>

                              {/* 合計 */}
                              <div style={{display:"flex",justifyContent:"flex-end",gap:16,fontSize:12,marginTop:8,paddingTop:8,borderTop:"1px solid #e2e8f0"}}>
                                <span><span style={{color:"#64748b"}}>機材: </span>{fmt(baseTot)}</span>
                                {adjSum!==0&&<span style={{color:adjSum<0?"#dc2626":"#16a34a"}}><span style={{color:"#64748b"}}>調整: </span>{fmt(adjSum)}</span>}
                                <span><span style={{color:"#64748b"}}>税抜: </span><strong>{fmt(grandTot)}</strong></span>
                                <span><span style={{color:"#64748b"}}>消費税: </span>{fmt(tax)}</span>
                                <strong style={{color:"#9333ea"}}>税込: {fmt(grandTot+tax)}</strong>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          }
        </div>
      </div>

      {/* プレビュー */}
      {preview&&(
        <div style={{width:480,flexShrink:0,position:"sticky",top:70}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#475569",display:"flex",alignItems:"center",gap:6}}>
              <Ico d={I.print} size={14} color="#1d4ed8"/>請求書 プレビュー
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={async()=>{
  const cur=getInvData(preview.key,preview.g.month);
  let baseNo=cur.invNo, count;
  if(!baseNo){baseNo=await nextInvoiceNo(preview.g.month);count=1;}
  else{count=(cur.printCount||1)+1;}
  await updateInvData(preview.key,{invNo:baseNo,printCount:count});
  const invNo=count<=1?baseNo:`${baseNo}-${count}`;
  downloadPrintHTML("invoice",{...preview.g,adjustments:cur.adjustments,invNo,issueDate:cur.issueDate||""});
}} style={{...S.btn("#1d4ed8",true),fontSize:11}}>🖨 PDF</button>
              <button onClick={()=>setPreview(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Ico d={I.x} size={16} color="#94a3b8"/></button>
            </div>
          </div>
          <div style={{...S.card,maxHeight:"calc(100vh - 160px)",overflowY:"auto",border:"2px solid #bfdbfe"}}>
            <InvoicePreview type="invoice" g={{...preview.g,adjustments:getInvData(preview.key).adjustments}}/>
          </div>
        </div>
      )}
    </div>
  );
}


function CustomerAnalysis({c, custRecords, products}){
  const [period, setPeriod] = useState("month"); // "month"|"quarter"
  const [chartView, setChartView] = useState("total"); // "total"|"project"

  // =========================================================
  // 売上推移データ（全体）
  // =========================================================
  const salesByPeriod = {};
  custRecords.forEach(r=>{
    if(!r.startDate) return;
    const d = new Date(r.startDate);
    const key = period==="month"
      ? r.startDate.slice(0,7)
      : `${d.getFullYear()}Q${Math.ceil((d.getMonth()+1)/3)}`;
    salesByPeriod[key] = (salesByPeriod[key]||0) + (r.amount||0);
  });
  const periodKeys = Object.keys(salesByPeriod).sort();
  const maxSales = Math.max(...Object.values(salesByPeriod), 1);
  const totalSales = custRecords.reduce((s,r)=>s+(r.amount||0), 0);

  // =========================================================
  // 案件別売上推移データ
  // =========================================================
  const projectNames = [...new Set(custRecords.map(r=>r.projectName||"案件名なし").filter(Boolean))];
  const COLORS = ["#2563eb","#16a34a","#9333ea","#ea580c","#0891b2","#65a30d","#dc2626","#7c3aed"];
  const salesByProject = {}; // {projectName: {period: amount}}
  custRecords.forEach(r=>{
    if(!r.startDate) return;
    const d = new Date(r.startDate);
    const pKey = period==="month" ? r.startDate.slice(0,7) : `${d.getFullYear()}Q${Math.ceil((d.getMonth()+1)/3)}`;
    const proj = r.projectName||"案件名なし";
    if(!salesByProject[proj]) salesByProject[proj] = {};
    salesByProject[proj][pKey] = (salesByProject[proj][pKey]||0) + (r.amount||0);
  });
  const allPeriodKeys = [...new Set(Object.values(salesByProject).flatMap(v=>Object.keys(v)))].sort();

  // =========================================================
  // よく使う製品ランキング
  // =========================================================
  const prodCount = {};
  const prodAmount = {};
  custRecords.forEach(r=>{
    const name = r.equipmentName||"不明";
    prodCount[name] = (prodCount[name]||0) + 1;
    prodAmount[name] = (prodAmount[name]||0) + (r.amount||0);
  });
  const topProds = Object.entries(prodCount)
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 8);

  // =========================================================
  // 利用履歴（新しい順、最大20件）
  // =========================================================
  const history = [...custRecords]
    .sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""))
    .slice(0, 20);

  return(
    <div style={{background:"#f8fafc",borderTop:"1px solid #e2e8f0",padding:"16px 16px 16px 62px"}}>
      {/* サマリー */}
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        {[
          {l:"累計売上（税抜）", v:fmt(totalSales), c:"#16a34a"},
          {l:"案件数", v:`${custRecords.length}件`, c:"#2563eb"},
          {l:"平均単価", v:custRecords.length?fmt(Math.round(totalSales/custRecords.length)):"―", c:"#9333ea"},
          {l:"最終利用", v:history[0]?.startDate?.slice(0,7)||"―", c:"#64748b"},
        ].map(s=>(
          <div key={s.l} style={{background:"#fff",borderRadius:8,padding:"8px 14px",border:"1px solid #e2e8f0",minWidth:110}}>
            <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>{s.l}</div>
            <div style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* 売上推移グラフ */}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"12px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:4}}>
            <div style={{fontSize:12,fontWeight:700,color:"#475569"}}>📈 売上推移</div>
            <div style={{display:"flex",gap:4}}>
              <div style={{display:"flex",gap:2,background:"#f1f5f9",borderRadius:5,padding:2}}>
                {[{k:"total",l:"全体"},{k:"project",l:"案件別"}].map(t=>(
                  <button key={t.k} onClick={()=>setChartView(t.k)} style={{
                    background:chartView===t.k?"#fff":"transparent",border:"none",borderRadius:4,
                    padding:"2px 8px",fontSize:10,fontWeight:chartView===t.k?700:500,
                    color:chartView===t.k?"#0f172a":"#94a3b8",cursor:"pointer"
                  }}>{t.l}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:2,background:"#f1f5f9",borderRadius:5,padding:2}}>
                {[{k:"month",l:"月別"},{k:"quarter",l:"四半期"}].map(t=>(
                  <button key={t.k} onClick={()=>setPeriod(t.k)} style={{
                    background:period===t.k?"#fff":"transparent",border:"none",borderRadius:4,
                    padding:"2px 8px",fontSize:10,fontWeight:period===t.k?700:500,
                    color:period===t.k?"#0f172a":"#94a3b8",cursor:"pointer"
                  }}>{t.l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 全体グラフ */}
          {chartView==="total"&&(periodKeys.length===0
            ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>データなし</div>
            :<div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,overflowX:"auto"}}>
              {periodKeys.map(k=>{
                const h = Math.max(4, Math.round((salesByPeriod[k]/maxSales)*80));
                return(
                  <div key={k} style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,minWidth:period==="month"?28:44}}>
                    <div style={{fontSize:8,color:"#94a3b8",marginBottom:2}}>{fmt(salesByPeriod[k]).replace("¥","")}</div>
                    <div style={{width:"100%",height:h,background:"#2563eb",borderRadius:"3px 3px 0 0",opacity:0.8}} title={`${k}: ${fmt(salesByPeriod[k])}`}/>
                    <div style={{fontSize:8,color:"#64748b",marginTop:2,transform:"rotate(-30deg)",whiteSpace:"nowrap"}}>{period==="month"?k.slice(2):k}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 案件別グラフ */}
          {chartView==="project"&&(allPeriodKeys.length===0
            ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>データなし</div>
            :<div>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,overflowX:"auto"}}>
                {allPeriodKeys.map(k=>{
                  const maxV = Math.max(...allPeriodKeys.map(pk=>projectNames.reduce((s,pj)=>s+(salesByProject[pj]?.[pk]||0),0)),1);
                  const total = projectNames.reduce((s,pj)=>s+(salesByProject[pj]?.[k]||0),0);
                  const h = Math.max(4, Math.round((total/maxV)*80));
                  let cumH = 0;
                  return(
                    <div key={k} style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,minWidth:period==="month"?28:44}}>
                      <div style={{width:"100%",height:h,position:"relative",display:"flex",flexDirection:"column-reverse"}}>
                        {projectNames.map((pj,pi)=>{
                          const v = salesByProject[pj]?.[k]||0;
                          if(!v) return null;
                          const ph = Math.round((v/maxV)*80);
                          return <div key={pj} style={{width:"100%",height:ph,background:COLORS[pi%COLORS.length],opacity:0.85}} title={`${pj}: ${fmt(v)}`}/>;
                        })}
                      </div>
                      <div style={{fontSize:8,color:"#64748b",marginTop:2,transform:"rotate(-30deg)",whiteSpace:"nowrap"}}>{period==="month"?k.slice(2):k}</div>
                    </div>
                  );
                })}
              </div>
              {/* 凡例 */}
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:8}}>
                {projectNames.map((pj,pi)=>(
                  <span key={pj} style={{fontSize:9,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{width:8,height:8,borderRadius:2,background:COLORS[pi%COLORS.length],display:"inline-block"}}/>
                    {pj}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* よく使う製品ランキング */}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"12px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:10}}>🏆 よく使う製品</div>
          {topProds.length===0
            ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>データなし</div>
            :topProds.map(([name, cnt], idx)=>{
              const bar = Math.round((cnt/topProds[0][1])*100);
              return(
                <div key={name} style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                    <span style={{color:"#475569",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <span style={{color:"#94a3b8",fontWeight:700,marginRight:4}}>#{idx+1}</span>{name}
                    </span>
                    <span style={{color:"#64748b",marginLeft:8,whiteSpace:"nowrap"}}>{cnt}回　{fmt(prodAmount[name])}</span>
                  </div>
                  <div style={{height:4,background:"#f1f5f9",borderRadius:2}}>
                    <div style={{height:4,width:`${bar}%`,background:idx===0?"#f59e0b":idx===1?"#94a3b8":idx===2?"#b45309":"#2563eb",borderRadius:2}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* 利用履歴 */}
      <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"12px 14px",marginTop:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:8}}>📋 利用履歴（直近20件）</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"#f8fafc",color:"#94a3b8"}}>
              {["開始日","案件名","機材","日数","金額（税抜）"].map(h=>(
                <th key={h} style={{padding:"4px 8px",textAlign:"left",fontWeight:600,borderBottom:"1px solid #e2e8f0"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((r,i)=>(
              <tr key={r.id} style={{borderBottom:"1px solid #f8fafc",background:i%2?"#fcfcfc":"#fff"}}>
                <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td>
                <td style={{padding:"4px 8px",color:"#64748b",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {r.projectName||"―"}
                  {r.ecOrderNo&&<span style={{marginLeft:4,fontSize:9,color:"#0369a1"}}>EC:{r.ecOrderNo}</span>}
                </td>
                <td style={{padding:"4px 8px",color:"#475569",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.equipmentName||"―"}</td>
                <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap",textAlign:"center"}}>
                  {r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.billingDays||r.days||0)}
                </td>
                <td style={{padding:"4px 8px",fontWeight:600,color:"#16a34a",textAlign:"right"}}>{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTab({customers,products,records,onSave,showToast,presetCustomers,openCustomerId,onOpenHandled}){
  const E={name:"",invoiceName:"",zipCode:"",address:"",contact:"",email:"",phone:"",discountRate:"0",paymentCycle:"月末締め 翌々月末日",splitInvoice:true,consolidateMonth:false,notes:"",staff:"",specialPrices:[],projects:[],showDeliveryPrice:false};
  const [form,setForm]=useState(E);
  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const [detailId,setDetailId]=useState(null); // 詳細ページ表示中の顧客ID
  const [exp,setExp]=useState(null);
  const [spProd,setSpProd]=useState("");
  const [spPrice,setSpPrice]=useState("");
  const [spQ,setSpQ]=useState("");
  const [custQ,setCustQ]=useState("");
  const [sortKey,setSortKey]=useState("name"); // "name" | "sales"
  const [projInput,setProjInput]=useState("");
  const xlsxInputRef=useRef(null);
  const importFromXlsx=async(file)=>{
    try{
      if(!window.XLSX){
        await new Promise((resolve,reject)=>{
          const s=document.createElement("script");
          s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload=resolve; s.onerror=reject;
          document.head.appendChild(s);
        });
      }
      const XLSX=window.XLSX;
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:"array"});
      const ws=wb.Sheets["M_顧客"];
      if(!ws){showToast("M_顧客シートが見つかりません",false);return;}
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      const header=rows[0];
      const idx=(key)=>header.findIndex(h=>h===key);
      const iName=idx("請求会社名"),iAddr=idx("住所"),iDiv=idx("部署/宛名補足"),iMail=idx("請求先メール"),
            iMode=idx("価格モード"),iRate=idx("掛け率"),iMemo=idx("メモ"),iPost=idx("郵送要否");
      const parsed=rows.slice(1).filter(r=>r[iName]).map(r=>{
        const addrFull=String(r[iAddr]||"");
        const zipM=addrFull.match(/〒?(\d{3}-?\d{4})/);
        const zip=zipM?zipM[1].replace("-",""):"";
        const addr=addrFull.replace(/^〒?\d{3}-?\d{4}\s*/,"");
        const mode=r[iMode]||"STANDARD";
        const kake=mode==="RATE"?Math.round((r[iRate]||1)*10):0;
        const notes=[r[iMemo]||"",r[iPost]?"郵送あり":""].filter(Boolean).join(" / ");
        return{id:uid(),name:String(r[iName]),invoiceName:String(r[iName]),zipCode:zip,address:addr,
          contact:String(r[iDiv]||""),email:String(r[iMail]||""),phone:"",
          discountRate:kake,paymentCycle:"月末締め 翌々月末日",splitInvoice:true,
          consolidateMonth:false,notes,specialPrices:[],projects:[],updatedAt:Date.now(),createdAt:Date.now()};
      });
      if(!parsed.length){showToast("読み込めるデータがありませんでした",false);return;}
      const existing=new Set(customers.map(c=>c.name));
      const added=parsed.filter(p=>!existing.has(p.name));
      const next=[...customers,...added];
      await onSave(next);
      showToast(`${added.length}社を追加しました（重複${parsed.length-added.length}社スキップ）`);
    }catch(e){
      showToast("読み込みに失敗しました: "+e.message,false);
    }
  };

  // 外部からIDが指定された場合、その顧客の編集フォームを自動で開く
  useEffect(()=>{
    if(!openCustomerId) return;
    const c = customers.find(x=>x.id===openCustomerId);
    if(!c) return;
    setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice});
    setEditId(c.id);
    setOpen(true);
    onOpenHandled&&onOpenHandled();
    // 該当顧客が見えるようにスクロール
    setTimeout(()=>document.getElementById(`cust-${c.id}`)?.scrollIntoView({behavior:"smooth",block:"center"}),100);
  },[openCustomerId]);

  // 顧客ごと売上集計
  const salesMap = {};
  (records||[]).forEach(r=>{
    salesMap[r.customerId] = (salesMap[r.customerId]||0) + (r.amount||0);
  });
  const getSales = id => salesMap[id]||0;

  const resetToPreset=async()=>{
    if(!confirm(`顧客データをプリセット（${presetCustomers.length}社）にリセットしますか？\n手動で追加した顧客は失われます。`))return;
    await onSave(presetCustomers);
    showToast(`${presetCustomers.length}社にリセットしました`);
  };

  // フォームデータを直接受け取って保存（setFormの非同期を回避）
  const saveCustomer=async(updatedForm)=>{
    if(!updatedForm.name){showToast("顧客名は必須",false);return;}
    const synced=syncSPs(updatedForm.specialPrices,products);
    const c={...updatedForm,specialPrices:synced,id:editId||uid(),discountRate:Number(updatedForm.discountRate)||0,staff:updatedForm.staff||"",updatedAt:Date.now(),createdAt:editId?customers.find(x=>x.id===editId)?.createdAt:Date.now()};
    await onSave(editId?customers.map(x=>x.id===editId?c:x):[...customers,c]);
    showToast("更新しました");
  };

  const addProj=async()=>{
    const v=projInput.trim();
    if(!v)return;
    if((form.projects||[]).includes(v)){setProjInput("");return;}
    const updated={...form,projects:[...(form.projects||[]),v]};
    setForm(updated);
    setProjInput("");
    await saveCustomer(updated);
  };
  const removeProj=(i)=>setForm(f=>({...f,projects:(f.projects||[]).filter((_,j)=>j!==i)}));

  const addSP=async()=>{
    if(!spProd||!spPrice) return;
    const p=products.find(x=>x.id===spProd);
    const updated={...form,specialPrices:[...(form.specialPrices||[]).filter(s=>s.productId!==spProd),{productId:spProd,productName:p?.fullName||"",price:Number(spPrice)}]};
    setForm(updated);
    setSpProd("");setSpPrice("");setSpQ("");
    await saveCustomer(updated);
  };

  const submit=async()=>{
    if(!form.name){showToast("顧客名は必須",false);return;}
    await saveCustomer(form);
    setForm(E); setEditId(null); setOpen(false);
  };

  const filteredSpProds = spQ.length>=1
    ? products.filter(p=>p.fullName.toLowerCase().includes(spQ.toLowerCase()))
    : [];
  if(detailId){
    const c=customers.find(x=>x.id===detailId);
    if(c){
      const custRecords=(records||[]).filter(r=>r.customerId===c.id);
      const openEdit=()=>{
        setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice});
        setEditId(c.id); setOpen(true);
      };
      return(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <button onClick={()=>{setDetailId(null);setOpen(false);setEditId(null);setForm(E);}} style={{...S.ib("#64748b"),fontSize:12}}>← 一覧に戻る</button>
            <div style={{flex:1,fontSize:16,fontWeight:800}}>{c.name}</div>
            <button onClick={openEdit} style={{...S.btn("#92400e",true),fontSize:12}}><Ico d={I.edit} size={13}/>内容を編集</button>
            <button onClick={async()=>{if(!confirm("削除？"))return;await onSave(customers.filter(x=>x.id!==c.id));setDetailId(null);showToast("削除しました");}} style={{...S.ib("#991b1b"),fontSize:12}}><Ico d={I.trash} size={13}/>削除</button>
          </div>
          {open&&editId===c.id&&(
            <div style={{...S.card,padding:24,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <h3 style={{margin:0,fontSize:16,fontWeight:700}}>顧客を編集</h3>
                <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客名 * （社内管理用）</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="株式会社〇〇"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書宛名（空欄の場合は顧客名を使用）</label><input value={form.invoiceName} onChange={e=>setForm(f=>({...f,invoiceName:e.target.value}))} style={S.inp} placeholder="例: 株式会社〇〇 制作部 ご担当者様"/></div>
                <div><label style={S.lbl}>郵便番号</label><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={S.inp} placeholder="000-0000"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>住所（最大3行、改行で区切り）</label><textarea value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={{...S.inp,height:66,resize:"vertical",lineHeight:1.6}} placeholder={"東京都港区新橋6-10-2\n第二新洋ビル 1F"}/></div>
                <div><label style={S.lbl}>担当者名</label><input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} style={S.inp}/></div>
                <div><label style={S.lbl}>電話</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={S.inp}/></div>
                <div><label style={S.lbl}>メール</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={S.inp}/></div>
                <div>
                  <label style={S.lbl}>掛け率 — 空欄 or 0=掛けなし（10掛）</label>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="number" min={0} max={9} step={0.5} value={form.discountRate} onChange={e=>setForm(f=>({...f,discountRate:e.target.value}))} style={{...S.inp,width:100}} placeholder="例: 8"/>
                    <span style={{fontSize:12,color:"#64748b"}}>
                      {(()=>{const k=Number(form.discountRate)||0;return k>0&&k<10?`${k}掛 → ${Math.round((1-k/10)*100)}%OFF`:"掛けなし（定価）"})()}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={S.lbl}>締め支払いサイクル</label>
                  <select value={form.paymentCycle} onChange={e=>setForm(f=>({...f,paymentCycle:e.target.value}))} style={S.inp}>
                    <option value="月末締め 翌月末日">月末締め 翌月末日</option>
                    <option value="月末締め 翌々月末日">月末締め 翌々月末日</option>
                    <option value="月末締め 翌々月5日">月末締め 翌々月5日</option>
                    <option value="月末締め 翌々月10日">月末締め 翌々月10日</option>
                    <option value="月末締め 翌々月25日">月末締め 翌々月25日</option>
                    <option value="スクエア">スクエア（都度払い）</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f8fafc",borderRadius:8,padding:"10px 14px"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>請求書の分割</label>
                  <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                    <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:true}))} style={{background:form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:form.splitInvoice?700:500,color:form.splitInvoice?"#1d4ed8":"#94a3b8",cursor:"pointer",boxShadow:form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>案件名ごとに分ける</button>
                    <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:false}))} style={{background:!form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:!form.splitInvoice?700:500,color:!form.splitInvoice?"#9333ea":"#94a3b8",cursor:"pointer",boxShadow:!form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>まとめて1枚</button>
                  </div>
                  <span style={{fontSize:10,color:"#94a3b8"}}>{form.splitInvoice?"案件名ごとに別々の請求書を発行":"全案件を1枚の請求書にまとめます（案件名は記録されます）"}</span>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#fff7ed",borderRadius:8,padding:"10px 14px",border:"1px solid #fed7aa"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#9a3412",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!form.consolidateMonth} onChange={e=>setForm(f=>({...f,consolidateMonth:e.target.checked}))} style={{cursor:"pointer"}}/>
                    日数値引き：日数が多い月に計上
                  </label>
                  <span style={{fontSize:10,color:"#64748b"}}>{form.consolidateMonth?"月またぎ案件は実日数が多い月にまとめて請求":"月末で切り分けて各月に請求（デフォルト）"}</span>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f0fdf4",borderRadius:8,padding:"10px 14px",border:"1px solid #bbf7d0"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#15803d",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!form.showDeliveryPrice} onChange={e=>setForm(f=>({...f,showDeliveryPrice:e.target.checked}))} style={{cursor:"pointer"}}/>
                    納品書に金額（単価）を記載する
                  </label>
                  <span style={{fontSize:10,color:"#64748b"}}>{form.showDeliveryPrice?"納品書（お客様用）に単価・機材Noを表示します":"デフォルト：納品書には金額を記載しません"}</span>
                </div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書 担当者名</label><input value={form.staff||""} onChange={e=>setForm(f=>({...f,staff:e.target.value}))} style={S.inp} placeholder="例: 井上 雄太（請求書PDFに表示）"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>備考</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={S.inp}/></div>
              </div>
              {/* 案件名リスト */}
              <div style={{marginTop:16,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#0369a1",display:"flex",alignItems:"center",gap:6}}>
                  📋 案件名（複数登録可）
                  <span style={{fontSize:11,fontWeight:400,color:"#64748b"}}>— 新規案件登録時のサジェストに使用</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,minHeight:32}}>
                  {(form.projects||[]).length===0
                    ?<span style={{fontSize:12,color:"#94a3b8"}}>案件名がありません</span>
                    :(form.projects||[]).map((p,i)=>(
                      <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#dbeafe",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                        {p}
                        <button onClick={()=>removeProj(i)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",color:"#3b82f6"}}><Ico d={I.x} size={12}/></button>
                      </span>
                    ))
                  }
                </div>
                <div style={{display:"flex",gap:8}}>
                  <input value={projInput} onChange={e=>setProjInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();}}} placeholder="例: CM撮影、バラエティー、ドキュメンタリー..." style={{...S.inp,flex:1}}/>
                  <button onClick={addProj} style={S.btn("#0369a1",true)}><Ico d={I.plus} size={13}/>追加</button>
                </div>
              </div>
              {/* 特別価格 */}
              <div style={{marginTop:16,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
                  <Ico d={I.star} size={14} color="#f59e0b"/>特別価格（この顧客専用）
                </div>
                {(form.specialPrices||[]).map((sp,i)=>{
                  const exists=products.some(x=>x.id===sp.productId);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,fontSize:12,opacity:exists?1:0.5}}>
                      <span style={{flex:1,fontWeight:600}}>{spName(sp,products)}</span>
                      <span style={{color:"#16a34a",fontWeight:700}}>{fmt(sp.price)}/日（税抜）</span>
                      {!exists&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>製品削除済</span>}
                      <button onClick={()=>setForm(f=>({...f,specialPrices:f.specialPrices.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={14} color="#ef4444"/></button>
                    </div>
                  );
                })}
                <div style={{marginBottom:6}}>
                  <input value={spQ} onChange={e=>setSpQ(e.target.value)} placeholder="製品名・ブランドで検索（1文字以上入力）..." style={{...S.inp,marginBottom:4}}/>
                  {spQ.length>=1?(
                    <select value={spProd} onChange={e=>setSpProd(e.target.value)} style={{...S.inp,marginBottom:6}} size={Math.min(6,filteredSpProds.length+1)}>
                      <option value="">検索結果: {filteredSpProds.length}件（全{products.length}件中）</option>
                      {filteredSpProds.map(p=><option key={p.id} value={p.id}>{p.fullName}（通常{fmt(p.priceEx)}）</option>)}
                    </select>
                  ):(
                    <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>🔍 製品名を入力すると全{products.length}件から検索できます</div>
                  )}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input type="number" value={spPrice} onChange={e=>setSpPrice(e.target.value)} placeholder="特別単価（税抜）" style={{...S.inp,width:160}}/>
                  <button onClick={addSP} style={S.btn("#f59e0b",true)}><Ico d={I.plus} size={13}/>追加</button>
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button onClick={submit} style={S.btn("#0f172a")}>更新</button>
                <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
              </div>
            </div>
          )}
          {!open&&(
            <div style={{...S.card,padding:"14px 18px",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:12}}>
                {[
                  ["請求書宛名", c.invoiceName||c.name],
                  ["担当者", c.contact||"―"],
                  ["住所", [c.zipCode?`〒${c.zipCode}`:null,c.address].filter(Boolean).join(" ")||"―"],
                  ["メール", c.email||"―"],
                  ["電話", c.phone||"―"],
                  ["支払サイクル", c.paymentCycle||"―"],
                  ["掛け率", Number(c.discountRate)>0&&Number(c.discountRate)<10?`${c.discountRate}掛`:"定価"],
                  ["請求まとめ", c.splitInvoice===false?"まとめ請求":"案件別"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",gap:8,borderBottom:"1px solid #f1f5f9",paddingBottom:4}}>
                    <span style={{color:"#94a3b8",minWidth:80,flexShrink:0}}>{l}</span>
                    <span style={{color:"#1e293b",fontWeight:500}}>{v||"―"}</span>
                  </div>
                ))}
              </div>
              {c.notes&&<div style={{marginTop:8,fontSize:11,color:"#64748b",background:"#f8fafc",borderRadius:4,padding:"6px 10px"}}>{c.notes}</div>}
              {syncSPs(c.specialPrices,products).length>0&&(
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:4}}>★ 特別価格</div>
                  {c.specialPrices.map((sp,j)=>(
                    <div key={j} style={{fontSize:12,color:"#555",marginBottom:3}}>
                      {spName(sp,products)} → <strong style={{color:"#16a34a"}}>{fmt(sp.price)}/日(税抜)</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <CustomerAnalysis c={c} custRecords={custRecords} products={products}/>
        </div>
      );
    }
  }

  return(
    <div>

      {open&&(
        <div style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"顧客を編集":"顧客を追加"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客名 * （社内管理用）</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="株式会社〇〇"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書宛名（空欄の場合は顧客名を使用）</label><input value={form.invoiceName} onChange={e=>setForm(f=>({...f,invoiceName:e.target.value}))} style={S.inp} placeholder="例: 株式会社〇〇 制作部 ご担当者様"/></div>
            <div><label style={S.lbl}>郵便番号</label><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={S.inp} placeholder="000-0000"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>住所（最大3行、改行で区切り）</label><textarea value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={{...S.inp,height:66,resize:"vertical",lineHeight:1.6}} placeholder={"東京都港区新橋6-10-2\n第二新洋ビル 1F"}/></div>
            <div><label style={S.lbl}>担当者名</label><input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>電話</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>メール</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>掛け率 — 空欄 or 0=掛けなし（10掛）</label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min={0} max={9} step={0.5} value={form.discountRate} onChange={e=>setForm(f=>({...f,discountRate:e.target.value}))} style={{...S.inp,width:100}} placeholder="例: 8"/>
                <span style={{fontSize:12,color:"#64748b"}}>
                  {(()=>{const k=Number(form.discountRate)||0;return k>0&&k<10?`${k}掛 → ${Math.round((1-k/10)*100)}%OFF`:"掛けなし（定価）"})()}
                </span>
              </div>
            </div>
            <div>
              <label style={S.lbl}>締め支払いサイクル</label>
              <select value={form.paymentCycle} onChange={e=>setForm(f=>({...f,paymentCycle:e.target.value}))} style={S.inp}>
                <option value="月末締め 翌月末日">月末締め 翌月末日</option>
                <option value="月末締め 翌々月末日">月末締め 翌々月末日</option>
                <option value="月末締め 翌々月5日">月末締め 翌々月5日</option>
                <option value="月末締め 翌々月10日">月末締め 翌々月10日</option>
                <option value="月末締め 翌々月25日">月末締め 翌々月25日</option>
                <option value="スクエア">スクエア（都度払い）</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f8fafc",borderRadius:8,padding:"10px 14px"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>請求書の分割</label>
              <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:true}))} style={{background:form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:form.splitInvoice?700:500,color:form.splitInvoice?"#1d4ed8":"#94a3b8",cursor:"pointer",boxShadow:form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>案件名ごとに分ける</button>
                <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:false}))} style={{background:!form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:!form.splitInvoice?700:500,color:!form.splitInvoice?"#9333ea":"#94a3b8",cursor:"pointer",boxShadow:!form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>まとめて1枚</button>
              </div>
              <span style={{fontSize:10,color:"#94a3b8"}}>{form.splitInvoice?"案件名ごとに別々の請求書を発行":"全案件を1枚の請求書にまとめます（案件名は記録されます）"}</span>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#fff7ed",borderRadius:8,padding:"10px 14px",border:"1px solid #fed7aa"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#9a3412",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={!!form.consolidateMonth} onChange={e=>setForm(f=>({...f,consolidateMonth:e.target.checked}))} style={{cursor:"pointer"}}/>
                日数値引き：日数が多い月に計上
              </label>
              <span style={{fontSize:10,color:"#64748b"}}>{form.consolidateMonth?"月またぎ案件は実日数が多い月にまとめて請求":"月末で切り分けて各月に請求（デフォルト）"}</span>
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書 担当者名</label><input value={form.staff||""} onChange={e=>setForm(f=>({...f,staff:e.target.value}))} style={S.inp} placeholder="例: 井上 雄太（請求書PDFに表示）"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>備考</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={S.inp}/></div>
          </div>
          {/* 案件名リスト */}
          <div style={{marginTop:16,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#0369a1",display:"flex",alignItems:"center",gap:6}}>
              📋 案件名（複数登録可）
              <span style={{fontSize:11,fontWeight:400,color:"#64748b"}}>— 新規案件登録時のサジェストに使用</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,minHeight:32}}>
              {(form.projects||[]).length===0
                ?<span style={{fontSize:12,color:"#94a3b8"}}>案件名がありません</span>
                :(form.projects||[]).map((p,i)=>(
                  <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#dbeafe",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                    {p}
                    <button onClick={()=>removeProj(i)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",color:"#3b82f6"}}>
                      <Ico d={I.x} size={12}/>
                    </button>
                  </span>
                ))
              }
            </div>
            <div style={{display:"flex",gap:8}}>
              <input
                value={projInput}
                onChange={e=>setProjInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();}}}
                placeholder="例: CM撮影、バラエティー、ドキュメンタリー..."
                style={{...S.inp,flex:1}}
              />
              <button onClick={addProj} style={S.btn("#0369a1",true)}><Ico d={I.plus} size={13}/>追加</button>
            </div>
          </div>
          <div style={{marginTop:16,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
              <Ico d={I.star} size={14} color="#f59e0b"/>特別価格（この顧客専用）
            </div>
            {(form.specialPrices||[]).map((sp,i)=>{
              const exists = products.some(x=>x.id===sp.productId);
              return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,fontSize:12,opacity:exists?1:0.5}}>
                <span style={{flex:1,fontWeight:600}}>{spName(sp,products)}</span>
                <span style={{color:"#16a34a",fontWeight:700}}>{fmt(sp.price)}/日（税抜）</span>
                {!exists&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>製品削除済</span>}
                <button onClick={()=>setForm(f=>({...f,specialPrices:f.specialPrices.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={14} color="#ef4444"/></button>
              </div>
            );})}
            <div style={{marginBottom:6}}>
              <input value={spQ} onChange={e=>setSpQ(e.target.value)} placeholder="製品名・ブランドで検索（1文字以上入力）..." style={{...S.inp,marginBottom:4}}/>
              {spQ.length>=1?(
                <select value={spProd} onChange={e=>setSpProd(e.target.value)} style={{...S.inp,marginBottom:6}} size={Math.min(6,filteredSpProds.length+1)}>
                  <option value="">検索結果: {filteredSpProds.length}件（全{products.length}件中）</option>
                  {filteredSpProds.map(p=><option key={p.id} value={p.id}>{p.fullName}（通常{fmt(p.priceEx)}）</option>)}
                </select>
              ):(
                <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>🔍 製品名を入力すると全{products.length}件から検索できます</div>
              )}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input type="number" value={spPrice} onChange={e=>setSpPrice(e.target.value)} placeholder="特別単価（税抜）" style={{...S.inp,width:160}}/>
              <button onClick={addSP} style={S.btn("#f59e0b",true)}><Ico d={I.plus} size={13}/>追加</button>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>{editId?"更新":"登録"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>顧客一覧（{customers.length}社）</h3>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:2,background:"#f1f5f9",borderRadius:6,padding:2}}>
              {[{k:"name",l:"あいうえお順"},{k:"sales",l:"売上高順"}].map(s=>(
                <button key={s.k} onClick={()=>setSortKey(s.k)} style={{background:sortKey===s.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"4px 10px",fontSize:11,fontWeight:sortKey===s.k?700:500,color:sortKey===s.k?"#1e293b":"#94a3b8",cursor:"pointer",boxShadow:sortKey===s.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{s.l}</button>
              ))}
            </div>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={custQ} onChange={e=>setCustQ(e.target.value)} placeholder="顧客名で検索..." style={{...S.inp,paddingLeft:28,width:180}}/>
            </div>
            <button onClick={()=>{setForm(E);setEditId(null);setOpen(true);}} style={S.btn("#0f172a")}><Ico d={I.plus} size={15}/>顧客を追加</button>
            <button onClick={()=>xlsxInputRef.current?.click()} style={S.btn("#0369a1",true)}>📥 Excelから読み込み</button>
            <input ref={xlsxInputRef} type="file" accept=".xlsx" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importFromXlsx(e.target.files[0]);e.target.value="";}}}/>
            <button onClick={resetToPreset} style={S.btn("#64748b",true)}>↺ リセット</button>
          </div>
        </div>
        {(()=>{
          const fc=customers.filter(c=>!custQ||c.name.toLowerCase().includes(custQ.toLowerCase()));
          const sorted = [...fc].sort((a,b)=>{
            if(sortKey==="sales") return getSales(b.id)-getSales(a.id);
            return a.name.localeCompare(b.name,"ja");
          });
          return sorted.length===0
          ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>「顧客を追加」から登録してください</div>
          :sorted.map((c,i)=>{
            const sales=getSales(c.id);
            const custRecords=(records||[]).filter(r=>r.customerId===c.id);

            const isSpOpen=exp===c.id;
            return(
            <div key={c.id} id={`cust-${c.id}`} style={{borderBottom:"1px solid #f1f5f9",background:i%2?"#fcfcfc":"#fff",cursor:"pointer"}} onClick={()=>setDetailId(c.id)}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:"#e0e7ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#4338ca",fontWeight:800,fontSize:14,flexShrink:0}}>{c.name.slice(0,1)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                    {c.paymentCycle&&<span style={{background:"#f0fdf4",color:"#166534",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>{c.paymentCycle}</span>}
                    {c.splitInvoice===false
                      ?<span style={{background:"#faf5ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>請求書まとめ</span>
                      :<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>案件別請求</span>
                    }
                    {c.consolidateMonth&&<span style={{background:"#fff7ed",color:"#9a3412",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>多い月計上</span>}
                    {c.contact&&`担当: ${c.contact}　`}
                    {(()=>{const k=Number(c.discountRate)||0;return k>0&&k<10?<span style={{color:"#16a34a",fontWeight:700}}>{k}掛　</span>:null;})()}
                    {(()=>{const valid=syncSPs(c.specialPrices,products);return valid.length>0?<span style={{color:"#f59e0b",fontWeight:700}}>★特別価格{valid.length}件</span>:null;})()}
                  </div>
                  {c.address&&<div style={{fontSize:10,color:"#b0b8c4",marginTop:1}}>{c.zipCode?`〒${c.zipCode} `:""}{c.address}</div>}
                </div>
                <div style={{textAlign:"right",marginRight:8,minWidth:80}}>
                  <div style={{fontSize:15,fontWeight:800,color:sales>0?"#16a34a":"#cbd5e1"}}>{sales>0?fmt(sales):"―"}</div>
                  {sales>0&&<div style={{fontSize:9,color:"#94a3b8"}}>売上(税抜)</div>}
                </div>

                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  {syncSPs(c.specialPrices,products).length>0&&<button onClick={()=>setExp(isSpOpen?null:c.id)} style={S.ib("#64748b")}><Ico d={I.star} size={12}/></button>}
                  <button onClick={()=>{setDetailId(c.id);setTimeout(()=>{setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice});setEditId(c.id);setOpen(true);},0);}} style={S.ib("#92400e")}><Ico d={I.edit} size={12}/>編集</button>
                  <button onClick={async()=>{if(!confirm("削除？"))return;await onSave(customers.filter(x=>x.id!==c.id));showToast("削除しました");}} style={S.ib("#991b1b")}><Ico d={I.trash} size={12}/></button>
                </div>
              </div>

              {/* 特別価格展開 */}
              {isSpOpen&&(c.specialPrices||[]).length>0&&(
                <div style={{padding:"0 16px 12px 62px"}}>
                  {c.specialPrices.map((sp,j)=>(
                    <div key={j} style={{fontSize:12,color:"#555",marginBottom:3}}>
                      {spName(sp,products)} → <strong style={{color:"#16a34a"}}>{fmt(sp.price)}/日(税抜)</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* 分析パネル展開 */}

            </div>
          )})

        })()}
      </div>
    </div>
  );
}

function ProductsTab({products,customers,onSave,showToast,allProducts}){
  const E={brand:"",name:"",priceIn:""};
  const [form,setForm]=useState(E);
  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [showImport,setShowImport]=useState(false);
  const [importText,setImportText]=useState("");

  // ブックマークレット本体（rental.olq.co.jpで実行→全製品JSONをクリップボードへ）
  const BOOKMARKLET = `javascript:(async()=>{const r=[];const seen=new Set();let page=1;let empty=0;while(empty<2){const url=page===1?'https://rental.olq.co.jp/?actmode=ItemList':'https://rental.olq.co.jp/?pageno='+page+'&actmode=ItemList';try{const h=await fetch(url).then(r=>r.text());const parts=h.split(/(?=<a[^>]*actmode=ItemDetail)/i);let found=0;for(const p of parts){const im=p.match(/iid=(\d+)/);if(!im)continue;const pm=p.match(/¥([\d,]+)\/日/);if(!pm)continue;const txt=p.replace(/<[^>]+>/g,'\n').replace(/\n{2,}/g,'\n');const priceIdx=txt.indexOf('¥');const lines=txt.slice(0,priceIdx).split('\n').map(l=>l.trim()).filter(l=>l&&!l.includes('.jpg')&&!l.startsWith('http'));if(lines.length<2)continue;const iid=im[1];if(seen.has(iid))continue;seen.add(iid);r.push({id:iid,brand:lines[lines.length-2],name:lines[lines.length-1],priceIn:parseInt(pm[1].replace(/,/g,''),10)});found++;}if(!found){empty++;}else{empty=0;}page++;}catch(e){break;}}await navigator.clipboard.writeText(JSON.stringify(r));alert('✅ '+r.length+'件をクリップボードにコピーしました。OLQアプリで「JSONを貼り付けて同期」してください。');})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(BOOKMARKLET)
      .then(() => showToast("ブックマークレットをコピーしました。ブックマークバーに追加してください。"))
      .catch(() => showToast("コピー失敗", false));
  };

  const importFromJson = async () => {
    try {
      const parsed = JSON.parse(importText.trim());
      const arr = Array.isArray(parsed) ? parsed : [];
      if (!arr.length) throw new Error("製品が見つかりません");
      const siteProds = arr.map(p => ({
        id: String(p.id||""),
        brand: String(p.brand||""),
        name: String(p.name||""),
        priceIn: Number(p.priceIn)||0,
        priceEx: Math.round((Number(p.priceIn)||0)/1.1),
        fullName: `${p.brand||""} ${p.name||""}`.trim()
      })).filter(p=>p.id&&p.name);
      const merged = mergeProducts(siteProds, products);
      const added = merged.length - products.length;
      await onSave(merged);
      setImportText(""); setShowImport(false);
      showToast(`同期完了（計${merged.length}件）${added>0?" — 新製品+"+added+"件":""}`);
    } catch(e) {
      showToast("JSONの形式が正しくありません: "+e.message, false);
    }
  };

  const filtered=products.filter(p=>!q||p.fullName.toLowerCase().includes(q.toLowerCase()));
  const getSPs=id=>customers.flatMap(c=>(c.specialPrices||[]).filter(s=>s.productId===id).map(s=>({...s,cname:c.name})));

  const submit=async()=>{
    if(!form.brand||!form.name||!form.priceIn){showToast("ブランド・製品名・定価(税込)は必須",false);return;}
    const priceIn=Number(form.priceIn);
    const priceEx=taxEx(priceIn);
    const p={brand:form.brand,name:form.name,priceIn,priceEx,id:editId||uid()};
    p.fullName=`${p.brand} ${p.name}`;
    await onSave(editId?products.map(x=>x.id===editId?p:x):[p,...products]);
    showToast(editId?"更新しました":"追加しました"); setForm(E); setEditId(null); setOpen(false);
  };

  const resetToDefault=async()=>{
    if(!confirm(`製品マスタをサイトのデータ（${allProducts.length}件）にリセットしますか？\nカスタム変更は失われます。`))return;
    await onSave(allProducts);
    showToast(`${allProducts.length}件にリセットしました`);
  };

  return(
    <div>
      {open&&(
        <div style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"製品を編集":"製品を追加"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px 20px"}}>
            <div><label style={S.lbl}>ブランド *</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} style={S.inp} placeholder="Sony"/></div>
            <div><label style={S.lbl}>製品名 *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="FX3"/></div>
            <div>
              <label style={S.lbl}>定価（税込）/日 *</label>
              <input type="number" value={form.priceIn} onChange={e=>setForm(f=>({...f,priceIn:e.target.value}))} style={S.inp} placeholder="例: 11000"/>
              {form.priceIn&&<div style={{fontSize:11,color:"#16a34a",marginTop:3}}>税抜: {fmt(taxEx(Number(form.priceIn)))}/日</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>{editId?"更新":"追加"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      <div style={{...S.card,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:13,color:"#64748b"}}>
          <strong style={{color:"#0f172a"}}>{products.length}件</strong>の製品
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="絞込..." style={{...S.inp,paddingLeft:28,width:200}}/>
          </div>
          <button onClick={()=>{setForm(E);setEditId(null);setOpen(true);}} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>製品を追加</button>
          <button onClick={()=>setShowImport(v=>!v)} style={S.btn("#0369a1",true)}>🔄 サイト同期</button>
          <button onClick={resetToDefault} style={S.btn("#64748b",true)}>↺ リセット</button>
        </div>
      </div>
      {showImport && (
        <div style={{...S.card,padding:20,marginBottom:14,border:"2px solid #0369a1"}}>
          <h3 style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"#0369a1"}}>🔄 OLQサイトと同期</h3>
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:14,marginBottom:14,fontSize:12.5,lineHeight:1.8}}>
            <b>手順：</b><br/>
            1. 下の「ブックマークレットをコピー」ボタンをクリック<br/>
            2. ブラウザのブックマークバーを右クリック →「ページを追加」→ URL欄に貼り付けて保存<br/>
            3. <a href="https://rental.olq.co.jp/?actmode=ItemList" target="_blank" style={{color:"#0369a1"}}>rental.olq.co.jp</a> を開く<br/>
            4. ブックマークレットをクリック → 完了アラートが出たら<br/>
            5. 下のテキストエリアに貼り付け（Ctrl+V）→「同期を実行」
          </div>
          <button onClick={copyBookmarklet} style={{...S.btn("#0369a1",true),marginBottom:12}}>📋 ブックマークレットをコピー</button>
          <div style={{marginBottom:8,fontSize:12,color:"#64748b"}}>ブックマークレット実行後、クリップボードの内容を貼り付けてください：</div>
          <textarea
            value={importText}
            onChange={e=>setImportText(e.target.value)}
            placeholder='ブックマークレット実行後、ここにCtrl+Vで貼り付け...'
            style={{width:"100%",minHeight:80,padding:10,fontSize:12,borderRadius:6,border:"1px solid #cbd5e1",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}
          />
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button onClick={importFromJson} disabled={!importText.trim()} style={S.btn("#16a34a",true)}>✅ 同期を実行</button>
            <button onClick={()=>{setShowImport(false);setImportText("");}} style={S.btn("#64748b",true)}>キャンセル</button>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
            <thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
              {["ブランド","製品名","定価(税込)/日","定価(税抜)/日","日数値引き","特別価格顧客",""].map(h=>(
                <th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0
                ?<tr><td colSpan={7} style={{padding:48,textAlign:"center",color:"#94a3b8"}}>製品がありません</td></tr>
                :filtered.map((p,i)=>{
                  const sps=getSPs(p.id);
                  return(
                    <tr key={p.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2?"#fcfcfc":"#fff"}}>
                      <td style={{padding:"9px 14px",color:"#64748b",fontSize:11}}>{p.brand}</td>
                      <td style={{padding:"9px 14px",fontWeight:600}}>{p.name}</td>
                      <td style={{padding:"9px 14px",textAlign:"right"}}>{fmt(p.priceIn)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(p.priceEx)}</td>
                      <td style={{padding:"9px 14px",textAlign:"center"}}>
                        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,cursor:"pointer",userSelect:"none"}} title="チェックを入れると日数値引きが非適用になります">
                          <input
                            type="checkbox"
                            checked={!!p.noBillingDiscount}
                            onChange={async e=>{
                              const updated=products.map(x=>x.id===p.id?{...x,noBillingDiscount:e.target.checked}:x);
                              await onSave(updated);
                              showToast(e.target.checked?"日数値引き非適用に設定しました":"日数値引き適用に戻しました");
                            }}
                          />
                          <span style={{color:p.noBillingDiscount?"#ef4444":"#94a3b8",fontWeight:p.noBillingDiscount?700:400}}>
                            {p.noBillingDiscount?"非適用":"―"}
                          </span>
                        </label>
                      </td>
                      <td style={{padding:"9px 14px"}}>
                        {sps.length===0
                          ?<span style={{fontSize:11,color:"#cbd5e1"}}>なし</span>
                          :sps.map((s,j)=><span key={j} style={{fontSize:11,background:"#fef3c7",color:"#92400e",borderRadius:4,padding:"2px 6px",marginRight:4}}>{s.cname}: {fmt(s.price)}</span>)
                        }
                      </td>
                      <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                        <button onClick={()=>{setForm({brand:p.brand,name:p.name,priceIn:String(p.priceIn)});setEditId(p.id);setOpen(true);}} style={{...S.ib("#92400e"),marginRight:4}}><Ico d={I.edit} size={12}/>編集</button>
                        <button onClick={async()=>{if(!confirm("削除？"))return;await onSave(products.filter(x=>x.id!==p.id));showToast("削除しました");}} style={S.ib("#991b1b")}><Ico d={I.trash} size={12}/></button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
      <div style={{marginTop:10,fontSize:12,color:"#94a3b8"}}>💡 特別価格は「顧客管理」タブの各顧客編集から設定できます</div>
    </div>
  );
}

// =========================================================
// LoginScreen
// =========================================================
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('メールアドレスまたはパスワードが正しくありません');
    setLoading(false);
  };

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f1f5f9',fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,boxShadow:'0 4px 32px rgba(0,0,0,0.10)',padding:'40px 36px',width:360}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:28}}>
          <div style={{background:'#0f172a',borderRadius:8,padding:'6px 10px'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <span style={{fontWeight:800,fontSize:17,letterSpacing:2,color:'#0f172a'}}>OLQ レンタル管理</span>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>パスワード</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          {error && <div style={{color:'#dc2626',fontSize:12,marginBottom:12,padding:'8px 12px',background:'#fef2f2',borderRadius:6}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'#0f172a',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// ImportScreen（localStorageデータ → Supabase移行）
// =========================================================
function ImportScreen({ onDone, showToast, setCustomers, setRecords, setInvoiceData, setProducts }) {
  const [json, setJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(l => [...l, msg]);

  const handleImport = async () => {
    setLoading(true);
    setLog([]);
    try {
      const data = JSON.parse(json);
      if (data['olqP7']?.length) {
        addLog(`製品マスタ: ${data['olqP7'].length}件 投入中...`);
        const rows = data['olqP7'].map(p => ({ id: String(p.id), data: p, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('products: ' + error.message);
        setProducts(data['olqP7']);
        addLog(`✅ 製品マスタ: ${rows.length}件 完了`);
      }
      if (data['olqC7']?.length) {
        addLog(`顧客: ${data['olqC7'].length}件 投入中...`);
        const rows = data['olqC7'].map(c => ({ id: String(c.id), data: c, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('customers: ' + error.message);
        setCustomers(data['olqC7']);
        addLog(`✅ 顧客: ${rows.length}件 完了`);
      }
      if (data['olqR7']?.length) {
        addLog(`案件: ${data['olqR7'].length}件 投入中...`);
        const rows = data['olqR7'].map(r => ({ id: String(r.id), data: r, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('cases').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('cases: ' + error.message);
        setRecords(data['olqR7']);
        addLog(`✅ 案件: ${rows.length}件 完了`);
      }
      if (data['olqInv7'] && Object.keys(data['olqInv7']).length) {
        addLog(`請求書: ${Object.keys(data['olqInv7']).length}件 投入中...`);
        const rows = Object.entries(data['olqInv7']).map(([id, v]) => ({
          id, data: v, is_locked: v?.status === 'locked', updated_at: new Date().toISOString()
        }));
        const { error } = await supabase.from('invoices').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('invoices: ' + error.message);
        setInvoiceData(data['olqInv7']);
        addLog(`✅ 請求書: ${rows.length}件 完了`);
      }
      const dno = data['olqDNo7'];
      const ino = data['olqINo7'];
      if (dno !== undefined && dno !== null) {
        await supabase.from('settings').upsert({ key: 'olqDNo7', value: String(dno) }, { onConflict: 'key' });
        addLog(`✅ 納品書連番: ${dno}`);
      }
      if (ino !== undefined && ino !== null) {
        await supabase.from('settings').upsert({ key: 'olqINo7', value: String(ino) }, { onConflict: 'key' });
        addLog(`✅ 請求書連番: ${ino}`);
      }
      addLog('🎉 移行完了！');
      showToast('データ移行が完了しました');
    } catch(e) {
      addLog('❌ エラー: ' + e.message);
      showToast('移行に失敗しました: ' + e.message, false);
    }
    setLoading(false);
  };

  return (
    <div style={{maxWidth:760,margin:'0 auto',padding:'40px 20px',fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.07)',padding:32}}>
        <h2 style={{margin:'0 0 6px',fontSize:18,fontWeight:800}}>📥 旧データ移行ツール</h2>
        <p style={{fontSize:12,color:'#64748b',margin:'0 0 20px'}}>
          旧OLQのブラウザコンソールで以下を実行してJSONをコピーし、下に貼り付けてください。
        </p>
        <pre style={{background:'#0f172a',color:'#86efac',borderRadius:8,padding:'12px 16px',fontSize:11,marginBottom:20,overflowX:'auto',lineHeight:1.6}}>
{`const keys=['olqP7','olqC7','olqR7','olqInv7','olqDNo7','olqINo7']
const d={}
keys.forEach(k=>{try{d[k]=JSON.parse(localStorage.getItem(k))}catch{d[k]=localStorage.getItem(k)}})
console.log(JSON.stringify(d))`}
        </pre>
        <textarea
          value={json}
          onChange={e=>setJson(e.target.value)}
          placeholder='ここにJSONを貼り付けてください...'
          style={{width:'100%',height:140,padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,fontFamily:'monospace',outline:'none',boxSizing:'border-box',resize:'vertical',marginBottom:14}}
        />
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <button onClick={handleImport} disabled={loading||!json.trim()}
            style={{background:'#2563eb',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:loading||!json.trim()?'not-allowed':'pointer',opacity:loading||!json.trim()?0.5:1}}>
            {loading ? '移行中...' : '移行を実行'}
          </button>
          <button onClick={onDone}
            style={{background:'none',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'10px 20px',fontSize:13,color:'#64748b',cursor:'pointer'}}>
            閉じる
          </button>
        </div>
        {log.length > 0 && (
          <div style={{background:'#f8fafc',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto'}}>
            {log.map((l,i)=>(
              <div key={i} style={{fontSize:12,color:l.startsWith('❌')?'#dc2626':l.startsWith('🎉')?'#16a34a':'#374151',lineHeight:1.8}}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
