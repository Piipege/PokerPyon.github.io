const SB = 10, BB = 20, TURN_MS = 30000, LEASE_MS = 16000, MAX_SEATS = 9;
const SUITS = ['♠','♥','♦','♣'];
const RL = {11:'J',12:'Q',13:'K',14:'A'};
const HAND_NAMES = ['Старшая карта','Пара','Две пары','Сет','Стрит','Флеш','Фулл-хаус','Каре','Стрит-флеш'];
const STREETS = {preflop:'префлоп', flop:'флоп', turn:'тёрн', river:'ривер', showdown:'вскрытие'};
const BOTS = [
  {name:'Борис', aggr:.55, loose:.10},
  {name:'Алиса', aggr:.30, loose:.04},
  {name:'Гоша',  aggr:.75, loose:.16},
  {name:'Вера',  aggr:.45, loose:.07},
  {name:'Дима',  aggr:.65, loose:.12},
  {name:'Катя',  aggr:.40, loose:.05},
  {name:'Лёва',  aggr:.85, loose:.20},
  {name:'Нина',  aggr:.50, loose:.08},
];
const P5 = 15**5;
const BLIND_LEVELS = [[10,20],[15,30],[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000]];
const $ = id => document.getElementById(id);
