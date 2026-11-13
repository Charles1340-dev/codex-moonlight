const island = "M282 374q54-26 113-33l76-83 50 47 66-93 103 117 49-32 79 45q48 8 105 32Z";
const rocks = "M251 374 316 346 359 362 440 319 489 345 593 267 649 318 721 297 816 348 931 374Z";
const building = "M-37 372v-57l37-21 37 21v57Z";
const tower = "M-15 372v-95h30v95ZM-22 277l22-45 22 45Z";
const settlement = (positions) => positions.map(([x, height], index) =>
  <path key={x} transform={"translate(" + x + " " + (height - 372) + ") scale(1 " + (744 - height) / 372 + ")"} d={index % 3 ? building : tower} />);

export function VoyageScenery({ scene }) {
  const palms = [389, 455, 532, 678, 782].map((x, index) =>
    <path key={x} transform={"translate(" + x + " " + (index % 2 ? 14 : 0) + ")"} d="M0 363q5-52 9-73M9 293q-22-27-44-8 27-5 44 11 14-27 40-18-25 2-40 18 30-7 43 11-23-10-43-6" fill="none" strokeWidth="5" />);
  const town = (positions, color = "#7eacc1") => <g fill={color}>{settlement(positions.map((x, index) => [x, 372 - index % 3 * 10]))}</g>;
  const bubbles = <g fill="none" stroke="#f4feff" strokeWidth="2.5" opacity=".72">
    {[[319, 207, 24], [455, 131, 10], [628, 231, 44], [815, 172, 23], [897, 278, 15], [756, 112, 12]].map(([x, y, radius]) => <circle key={x} cx={x} cy={y} r={radius} />)}
  </g>;
  const landscape = {
    syrup: <><path d={island} fill="#a4c8bb" />{town([423, 490, 557, 618, 688, 766])}<path d="M308 372q160-48 240-20t350 20" fill="#6b9f96" /></>,
    baratie: <g fill="#73a2be"><path d="M376 374q88-105 236-73 84 4 136 58l103-43-21 57 21 36-109-27q-182 43-366-8Z" /><path d="M464 310v-57h206v59Z" /><path d="M437 254 570 198 698 254Z" fill="#b0cbd1" /><circle cx="439" cy="355" r="13" fill="#eafcff" /></g>,
    cocoyasi: <><path d={rocks} fill="#a8c9ac" />{town([520, 585, 646, 735], "#8cac9b")}<g stroke="#598d82">{palms}</g></>,
    loguetown: <>{town([318, 383, 449, 513, 582, 656, 724, 792, 859])}<path d="M550 371v-137h102v137M539 237l62-56 62 56Z" fill="#6b95b0" /><circle cx="601" cy="263" r="16" fill="#e7f7ff" /></>,
    cape: <><path d="M262 374 417 213 508 374M668 374l119-183 159 183" fill="#8fb5cc" /><path d="M438 374q61-61 117-45 86 22 109 45" fill="#698eaa" /><path d="M741 354v-109h17v109M735 245l14-25 15 25Z" fill="#f4fdff" /></>,
    whiskey: <><path d={rocks} fill="#98bab7" /><g stroke="#6c9b97" strokeWidth="12" strokeLinecap="round"><path d="M490 366v-105m0 62h-27v-29m27 17h28v-43M653 363V235m0 75h34v-38m-34 10h-32v-26M754 370v-62m0 38h26v-23" /></g></>,
    garden: <><path d="M300 375 486 319l98-155 24 5 110 157 198 49Z" fill="#86a6b5" /><path d="M545 224l39-60 24 5 42 57-36-14-22 14-18-13Z" fill="#ccad9d" /><path d="M286 375q40-77 94-23 55-86 120 0 38-72 111 7 80-80 140 2 85-70 173 14" fill="#719d91" /></>,
    drum: <><path d="M292 374 426 251 498 278 576 151 648 275 714 205 885 374Z" fill="#92b9d0" /><path d="M425 252l73 26 78-127 72 124 66-70 75 76-74-41-67 65-72-99-65 100Z" fill="#f1fbff" /><path d="M553 205v-59h45v59m-54-59 32-24 31 24" fill="#6e98af" /></>,
    alabasta: <><path d="M245 374q181-103 385-48 159-55 342 48Z" fill="#dfc9a4" />{town([421, 499, 688, 774], "#b5a887")}<path d="M535 373v-80h126v80M535 293q63-102 126 0Z" fill="#c8ab80" /></>,
    jaya: <><path d={island} fill="#94bdbe" />{town([374, 440, 504, 569, 638], "#83a6b2")}<path d="M704 372q107-75 49-209-52 89-71 209" fill="#d8f6ff" opacity=".72" /></>,
    sky: <><path d="M255 340q14-42 60-37 25-47 87-34 30-67 105-53 39-69 112-41 69-43 119 21 89-15 129 67 69-9 90 62Z" fill="#effcff" /><path d="M535 304h144l-20-25v-38q-15-52-52-53-39 0-53 53v38Z" fill="#d5bd7f" /><circle cx="609" cy="302" r="13" fill="#ad9559" /></>,
    longring: <><path d="M226 373q114-99 303-43 202-68 442 43Z" fill="#a6cbb3" /><path d="M445 373v-65m154 65v-65m148 65v-65M445 310l154-6 148 6" fill="none" stroke="#689784" strokeWidth="5" /></>,
    water: <WaterCity town={town} />,
    enies: <><path d="M270 375h660l-68-53H345Z" fill="#a0b9cf" /><path d="M391 367v-93h418v93M492 275v-68h216v68M554 205l46-60 46 60" fill="#86abc3" /><path d="M312 370h50v61h-50m120-61h48v61h-48m290-61h48v61h-48m120-61h48v61h-48" fill="#eafaff" /></>,
    farewell: <><path d="M182 354q164-56 333 0t384-8 144 8v42H182Z" fill="#c6d8e3" /><path d="M511 351q84-58 166 0" fill="none" stroke="#f8fdff" strokeWidth="4" /><path d="M582 339q-7-22 16-41-4 20 17 41" fill="#d8aa92" opacity=".68" /></>,
    sunny: <WaterCity town={town} />,
    thriller: <><path d="M269 374h660l-91-69-92 20-68-43-44 49-76-64-73 57-108-9Z" fill="#778aa8" />{town([442, 504, 567, 630, 693, 754], "#697f9d")}<path d="M315 363q103-28 221-8t337 2" fill="none" stroke="#e1e8f4" strokeWidth="12" opacity=".56" /></>,
    sabaody: <><TreeGrove />{bubbles}</>,
    amazon: <><path d={island} fill="#96bcae" /><path d="M344 369q53-117 171-94 72 22 53 83m65 11q38-102 121-76 67 19 78 76" fill="none" stroke="#77a491" strokeWidth="24" />{town([510, 578, 651, 720])}</>,
    impel: <><path d="M436 367h328l-26-90H462Z" fill="#879eb8" /><path d="M479 279v-79h242v79M565 201v-58h70v58" fill="#9db2c8" /><path d="M421 370h358l-52 118H473Z" fill="#6f90b3" opacity=".55" /></>,
    marine: <><path d="M288 374h630l-62-38H350Z" fill="#b1c7d9" /><path d="M388 359V245h426v114M481 245v-54h240v54M535 191l65-48 65 48Z" fill="#839fb9" /><path d="M405 307h389" stroke="#e9f5fc" strokeWidth="9" /></>,
    reunion: <><TreeGrove />{bubbles}</>,
    fishman: <><circle cx="601" cy="281" r="130" fill="#b3e3ee" stroke="#efffff" strokeWidth="5" />{town([500, 550, 607, 663, 713], "#88b7c9")}{bubbles}</>,
    punk: <><path d="M258 374 460 224 597 374Z" fill="#d6a99f" /><path d="M594 374 747 206 937 374Z" fill="#a2d0e1" /><path d="M711 246l36-40 54 50-41-14-25 15Z" fill="#f4fdff" /><path d="M432 262q-20-33 24-74-7 44 20 76" fill="#d99a89" /></>,
    dressrosa: <><path d={island} fill="#afc0c1" />{town([343, 411, 480, 558, 642, 720, 799, 871], "#b7a8a6")}<path d="M523 370v-83q82-42 164 0v83m-164-60h164" fill="#a88f92" stroke="#e4c8bc" strokeWidth="5" /></>,
    zou: <><path d="M449 373V266q37-64 154-63 76 4 120 61l62 17 18 88h-33l-20-59-23-4v67h-53v-62H510v62Z" fill="#83a9bf" /><path d="M447 265q66-98 177-77 61 8 93 77Z" fill="#9dbca9" />{town([514, 566, 612, 650], "#78a498")}</>,
    cake: <><path d="M331 374h526l-30-75H361Zm74-75h379l-28-69H435Zm79-69h224l-30-64H515Z" fill="#c4b6ca" /><path d="M361 300q25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0 25 26 50 0" fill="none" stroke="#f6e9ed" strokeWidth="12" /></>,
    wano: <><path d={island} fill="#9db7be" /><path d="M442 374v-74h300v74M498 299v-70h188v70" fill="#8ea7bb" /><path d="M417 300h349l-59-36H478Zm57-70h237l-51-36H523Z" fill="#788eab" /><path d="M784 365q36-31 34-100 27 42 9 113" fill="#d8f4fc" /></>,
    egghead: <><path d="M316 371q28-51 107-44 71-56 176-21 104-35 174 21 80-7 107 44Z" fill="#e7f7fc" /><ellipse cx="598" cy="239" rx="105" ry="77" fill="#a4c9e0" /><ellipse cx="598" cy="243" rx="147" ry="24" fill="none" stroke="#f4fcff" strokeWidth="10" transform="rotate(-12 598 243)" /><circle cx="597" cy="212" r="26" fill="#cce9f8" /></>,
    elbaf: <><path d={island} fill="#91b8b0" /><path d="M548 367q42-125 21-238h58q-18 123 27 238Z" fill="#789e9f" /><path d="M351 151q26-62 111-56 28-50 95-39 43-62 110-15 85-18 113 47 79 7 104 63-94 57-263 47-160 16-270-47Z" fill="#a5cbbd" />{town([421, 488, 709, 775])}</>,
  };
  return <g>{landscape[scene]}</g>;
}

function WaterCity({ town }) {
  return <><path d="M276 374 356 338 451 271 527 252 602 184 681 252 755 270 853 342 924 374Z" fill="#a9c6d4" />
    {town([349, 412, 478, 540, 602, 664, 730, 795, 858], "#84a8bf")}
    <path d="M602 224q-31 52 10 86t-17 74" fill="none" stroke="#e5f8fe" strokeWidth="13" />
  </>;
}

function TreeGrove() {
  return <g fill="#9dc6c4" stroke="#77a7a8" strokeWidth="4">
    {[[367, 264], [465, 217], [572, 184], [703, 229], [821, 263]].map(([x, y]) =>
      <g key={x}><path d={"M" + x + " 375V" + y} strokeWidth="13" /><ellipse cx={x} cy={y} rx="63" ry="30" /></g>)}
  </g>;
}
