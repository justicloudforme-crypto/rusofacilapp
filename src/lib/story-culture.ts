/**
 * Hand-written cultural notes for the library's classic (non-original)
 * stories: where the text comes from, when it was written or recorded,
 * and what place it holds in Russian culture.
 *
 * Why these are written by hand. Everything else added to a thin story
 * page in this project is derived from the story's own text by code (see
 * src/lib/story-insights.ts). That approach has a ceiling: it can say
 * which words and which grammar a text contains, but it cannot say that
 * «Сказка о рыбаке и рыбке» is Pushkin reworking a tale the Brothers
 * Grimm had recorded in Pomerania. Nothing in the story's characters
 * encodes that. So this file is the one content type here that is
 * deliberately manual — 40 notes, each researched and written one at a
 * time, in both site languages.
 *
 * Two hard rules, the same ones the derived block follows:
 *
 *  1. **Origin, never plot.** A note says where the text came from and
 *     why it is known. It does not retell it and never says how it ends.
 *     These pages are paywalled: a note that summarised the story would
 *     remove the reason to subscribe, which is exactly the failure mode
 *     this whole line of work has to avoid.
 *  2. **Nothing templated.** There is no "this tale is a classic of
 *     Russian folklore" sentence with a title substituted in. If there
 *     were nothing specific to say about a story, it would get no note
 *     at all rather than a filled-in template.
 *
 * Scope. Only stories whose `author` is not RusoFácilapp's own — 48 of
 * the 325 in the library. Eight of those 48 are A1 tales inside the
 * frozen thin-page experiment (5 in the pilot, 3 in the control), so
 * they are deliberately absent here and must stay absent until the
 * experiment closes on 25.09.2026. `story-culture.test.ts` enforces
 * that, so the freeze cannot be broken by editing this file alone.
 *
 * Keyed by title, with the level checked on lookup — Story.id drifts
 * between dev.db and Turso, so (title, level) is the safe key, the same
 * convention as src/lib/story-pilot.ts.
 */

export interface CulturalNote {
  /** Level the story sits at, so a title collision can't misfire. */
  level: string;
  es: string;
  ru: string;
}

const NOTES: Record<string, CulturalNote> = {
  // ——— Л.Н. Толстой: «Азбука» и «Русские книги для чтения» ———
  "Косточка": {
    level: "A2",
    es: "Tolstói escribió este relato para la «Nueva cartilla» (1875), el manual con el que enseñaba a leer a los niños campesinos de su escuela de Yásnaya Poliana. Buscaba deliberadamente frases cortas y palabras que un niño de pueblo ya conociera, y ese estilo desnudo, sin una sola descripción de adorno, se volvió después un modelo de prosa infantil rusa.",
    ru: "Толстой написал этот рассказ для «Новой азбуки» (1875) — учебника, по которому учил читать крестьянских детей в своей яснополянской школе. Он сознательно искал короткую фразу и слова, уже знакомые деревенскому ребёнку, и этот оголённый стиль, без единого украшающего описания, позже стал образцом русской детской прозы.",
  },
  "Акула": {
    level: "A2",
    es: "Uno de los relatos que Tolstói reunió en sus «Libros rusos de lectura» (1870s), la continuación de su cartilla escolar. Los marcó como «быль», es decir, sucedido de verdad, no inventado: le importaba que el niño leyera algo que pudiera haber ocurrido. Sigue siendo lectura escolar obligatoria en Rusia siglo y medio después.",
    ru: "Один из рассказов, собранных Толстым в «Русских книгах для чтения» (1870-е) — продолжении его школьной азбуки. Он помечал их словом «быль», то есть случившееся на самом деле, а не выдуманное: ему было важно, чтобы ребёнок читал о том, что могло произойти. Полтора века спустя рассказ по-прежнему в школьной программе.",
  },
  "Филипок": {
    level: "A2",
    es: "Escrito para la «Cartilla» de Tolstói (1872). El autor de «Guerra y paz» dedicó años a la pedagogía: fundó una escuela para hijos de campesinos en su finca y redactó él mismo los materiales, convencido de que no existía un ruso escrito lo bastante sencillo. El nombre del protagonista, en diminutivo campesino, es hoy una de las palabras más reconocibles de la infancia lectora rusa.",
    ru: "Написано для «Азбуки» Толстого (1872). Автор «Войны и мира» отдал педагогике не один год: он открыл в имении школу для крестьянских детей и сам составлял для неё материалы, считая, что достаточно простого русского письменного языка попросту не существует. Крестьянское уменьшительное имя героя сегодня — одно из самых узнаваемых слов русского читательского детства.",
  },
  "Прыжок": {
    level: "A2",
    es: "Otro «быль» de los «Libros rusos de lectura» de Tolstói, ambientado a bordo de un barco. Tolstói eligió a propósito escenarios lejanos —el mar, países extranjeros, animales— para que el niño campesino, que nunca había salido de su aldea, leyera algo que ampliara su mundo y no solo lo repitiera. Tolstói reescribió estos textos muchas veces, buscando la versión con menos palabras posible.",
    ru: "Ещё одна «быль» из «Русских книг для чтения» Толстого, действие которой происходит на корабле. Толстой намеренно выбирал далёкие декорации — море, чужие страны, животных, — чтобы крестьянский ребёнок, ни разу не выезжавший из своей деревни, читал то, что расширяет его мир, а не повторяет его. Эти тексты Толстой переписывал помногу раз, добиваясь варианта с наименьшим числом слов.",
  },
  "Лев и собачка": {
    level: "B1",
    es: "Tolstói lo publicó en sus «Libros rusos de lectura» y lo presentó como un hecho real ocurrido en una casa de fieras de Londres, de esas que en el siglo XIX se visitaban pagando entrada. Es de los textos suyos más breves y de los más citados cuando se habla de cómo enseñaba a los niños a sentir con un animal.",
    ru: "Толстой напечатал его в «Русских книгах для чтения» и подал как случай, действительно произошедший в лондонском зверинце — из тех, куда в XIX веке пускали за плату. Это один из самых коротких его текстов и один из самых часто цитируемых, когда говорят о том, как он учил детей сочувствовать животному.",
  },
  "Пожарные собаки": {
    level: "B1",
    es: "Tolstói lo tomó de las noticias sobre los bomberos de Londres, que adiestraban perros para entrar en las casas en llamas, y lo reescribió como «быль» para sus libros escolares. Es un buen ejemplo de su método: un hecho leído en la prensa extranjera, contado en las frases más simples que el ruso permite.",
    ru: "Толстой взял сюжет из сообщений о лондонских пожарных, которые обучали собак входить в горящие дома, и переписал его как «быль» для своих школьных книг. Хороший пример его метода: факт, вычитанный в иностранной печати, изложен самыми простыми фразами, какие допускает русский язык. Слово «быль» в подзаголовке было для Толстого принципиальным: он считал, что ребёнку незачем читать выдуманное.",
  },
  "Кавказский пленник": {
    level: "B1",
    es: "Publicado en 1872 y nacido de la experiencia propia: Tolstói sirvió en el Cáucaso a comienzos de los años cincuenta, durante la larga guerra de Rusia en la región, y estuvo él mismo cerca de ser capturado. Decía que era lo mejor que había escrito, precisamente por su lengua desnuda, sin literatura encima.",
    ru: "Опубликован в 1872 году и вырос из личного опыта: Толстой служил на Кавказе в начале 1850-х, во время долгой войны России в этом краю, и сам однажды едва не попал в плен. Он говорил, что это лучшее из им написанного — именно из-за оголённого языка, без литературы поверх него. Позже он включил повесть в свои книги для чтения, предназначенные детям.",
  },
  "Три вопроса": {
    level: "C1",
    es: "Parábola tardía, de 1903, de los años en que Tolstói había dejado la novela por la prosa moral breve. La incluyó en «El círculo de lectura», su antología de textos para meditar día a día. Su forma —un soberano, una pregunta, un sabio apartado del mundo— viene de la tradición de los cuentos orientales que él leía y adaptaba.",
    ru: "Поздняя притча, 1903 год, из тех лет, когда Толстой оставил роман ради короткой нравственной прозы. Он включил её в «Круг чтения» — свой сборник текстов для ежедневного размышления. Её форма — правитель, вопрос, удалившийся от мира мудрец — идёт от восточных сказаний, которые он читал и перекладывал.",
  },

  // ——— Русские народные сказки, свод Афанасьева ———
  "Гуси-лебеди": {
    level: "A2",
    es: "Cuento popular ruso fijado por escrito por Alexánder Afanásiev en «Cuentos populares rusos» (1855–1863), la recopilación que hizo por Rusia lo que los Grimm por Alemania: pasar a papel lo que hasta entonces solo se contaba en voz alta. Los ayudantes que el protagonista encuentra por el camino —el horno, el manzano, el río de leche— son objetos de la vida campesina convertidos en personajes.",
    ru: "Русская народная сказка, записанная Александром Афанасьевым в «Народных русских сказках» (1855–1863) — своде, который сделал для России то же, что братья Гримм для Германии: перенёс на бумагу то, что до этого только рассказывали вслух. Помощники, которых героиня встречает в пути, — печка, яблоня, молочная река — это предметы крестьянского быта, ставшие персонажами.",
  },
  "Маша и медведь": {
    level: "A2",
    es: "Cuento popular recogido también por Afanásiev en el siglo XIX. Hoy el título arrastra un equívoco: la serie animada rusa homónima, estrenada en 2009 y una de las más vistas del mundo en YouTube, no cuenta esta historia y solo toma de ella la pareja de protagonistas. El cuento original es muy anterior y bastante distinto.",
    ru: "Народная сказка, записанная в XIX веке всё тем же Афанасьевым. Сегодня название тянет за собой путаницу: одноимённый мультсериал, вышедший в 2009 году и ставший одним из самых просматриваемых в мире на YouTube, эту историю не рассказывает и берёт из неё только пару героев. Сама сказка гораздо старше и заметно другая.",
  },
  "Каша из топора": {
    level: "A2",
    es: "Pertenece a las «сказки о солдате», el ciclo de cuentos rusos cuyo héroe es un soldado que vuelve del servicio sin dinero y se las arregla con ingenio. El argumento no es solo ruso: los folkloristas lo catalogan como el tipo internacional de la «sopa de piedra», documentado por toda Europa y también fuera de ella. Lo ruso aquí no es la trama, sino el soldado licenciado como figura reconocible.",
    ru: "Относится к солдатским сказкам — русскому циклу, где герой возвращается со службы без гроша и выкручивается смекалкой. Сюжет не только русский: фольклористы относят его к международному типу «каменного супа», зафиксированному по всей Европе и за её пределами. Русское здесь не сюжет, а сама фигура отставного солдата, узнаваемая слушателем.",
  },
  "Лиса и журавль": {
    level: "A2",
    es: "Cuento de animales de la colección de Afanásiev, construido sobre una simetría exacta: dos invitaciones que se responden una a otra. Esa composición en espejo es un rasgo típico de la narración oral, donde la simetría es lo que permite recordar el relato sin tenerlo escrito. La pareja de animales protagonista es fija en el repertorio ruso y reaparece en otros cuentos del mismo corpus.",
    ru: "Сказка о животных из собрания Афанасьева, построенная на точной симметрии: два приглашения, отвечающие одно другому. Такая зеркальная композиция — типичная черта устного рассказа, где именно симметрия позволяет запомнить сюжет, не имея его записанным. Пара животных здесь для русского репертуара устойчивая: те же герои встречаются и в других сказках того же свода.",
  },
  "Вершки и корешки": {
    level: "A2",
    es: "Cuento campesino sobre un reparto de cosecha pactado de antemano, recogido en el siglo XIX. Pertenece a un humor muy concreto: el del campesino que negocia con una fuerza mayor que él y solo puede ganar con la cabeza. Es de los pocos cuentos rusos cuyo eje es un contrato, no una prueba mágica. Las dos palabras del título son términos agrícolas: la parte de arriba de la planta y su raíz.",
    ru: "Крестьянская сказка о заранее оговорённом дележе урожая, записанная в XIX веке. Она принадлежит вполне определённому юмору: мужик договаривается с силой, которая больше него, и выиграть может только головой. Это одна из немногих русских сказок, в основе которых лежит договор, а не волшебное испытание. Оба слова в заглавии — обычные сельские термины: верхняя часть растения и его корень.",
  },
  "Морозко": {
    level: "B2",
    es: "Cuento de invierno del repertorio recogido por Afanásiev, donde la helada aparece personificada como un señor del bosque. En 1964 Alexánder Rou lo llevó al cine, y esa película sigue emitiéndose cada invierno en la televisión rusa: para varias generaciones, el cuento y la película son ya la misma cosa.",
    ru: "Зимняя сказка из свода Афанасьева, где мороз выступает как одушевлённый хозяин леса. В 1964 году её экранизировал Александр Роу, и этот фильм до сих пор показывают каждую зиму по российскому телевидению: для нескольких поколений сказка и фильм давно слились в одно. Фильм Роу известен и за пределами России: в США он десятилетиями шёл как пример особенно странного детского кино.",
  },
  "Царевна-лягушка": {
    level: "B2",
    es: "Cuento maravilloso ruso —«волшебная сказка»— del corpus de Afanásiev, con la estructura completa del género: una prueba, un objeto mágico y un viaje al otro mundo. Su imagen visual la fijó Iván Bilibin, cuyas ilustraciones de principios del siglo XX son las que casi todo ruso ve mentalmente al oír el título.",
    ru: "Русская волшебная сказка из корпуса Афанасьева, с полной структурой жанра: испытание, волшебный предмет и путешествие в иной мир. Её зрительный образ закрепил Иван Билибин — именно его иллюстрации начала XX века встают перед глазами почти у любого русского при этом названии. Афанасьев записал несколько разных вариантов сюжета, и они заметно расходятся между собой.",
  },
  "Летучий корабль": {
    level: "C1",
    es: "Cuento popular del tipo «el tonto que resulta no serlo», con una tropa de compañeros dotados cada uno de una habilidad imposible. En 1979 el estudio Soyuzmultfilm hizo con él un corto musical que se volvió enormemente popular, hasta el punto de que sus canciones se conocen hoy mejor que el texto folclórico del que salieron.",
    ru: "Народная сказка типа «дурак, который оказывается не дурак», с ватагой спутников, у каждого из которых своя невозможная способность. В 1979 году «Союзмультфильм» снял по ней музыкальный мультфильм, ставший невероятно популярным, — настолько, что песни из него сегодня известны лучше, чем сам фольклорный текст.",
  },

  // ——— А.П. Чехов ———
  "Толстый и тонкий": {
    level: "B1",
    es: "Publicado en 1883 en la revista humorística «Oskolki» y firmado «Antosha Chejonté», el seudónimo con el que Chéjov, todavía estudiante de medicina, escribía por dinero. Los relatos de esos años debían caber en una columna, y de esa limitación de espacio salió su famosa concisión. Chéjov llegó a publicar varios cientos de piezas así antes de firmar nada con su apellido.",
    ru: "Напечатан в 1883 году в юмористическом журнале «Осколки» и подписан «Антоша Чехонте» — псевдонимом, которым Чехов, ещё студент-медик, подписывал написанное ради заработка. Рассказы тех лет должны были умещаться в колонку, и из этого ограничения по месту выросла его знаменитая краткость. Таких вещей он напечатал несколько сотен, прежде чем начал подписываться собственной фамилией.",
  },
  "Хамелеон": {
    level: "B1",
    es: "De 1884, también de «Oskolki» y de la etapa de Chéjov humorista. El título dio al ruso una expresión de uso corriente: llamar «camaleón» a quien cambia de opinión según quién esté delante. Es uno de los pocos casos en que un relato breve deja una palabra fija en la lengua rusa. Como casi todo Chéjov de esos años, se publicó sin ilustración y ocupando poco más de dos columnas.",
    ru: "1884 год, тоже «Осколки» и тоже пора Чехова-юмориста. Название дало русскому языку ходовое выражение: «хамелеоном» называют того, кто меняет мнение в зависимости от того, кто перед ним. Это один из немногих случаев, когда короткий рассказ закрепил в языке слово. Как почти всё у Чехова тех лет, он вышел без иллюстрации и занял чуть больше двух колонок.",
  },
  "Злоумышленник": {
    level: "B1",
    es: "Apareció en 1885 en «Peterbúrgskaya gazeta». Es un interrogatorio y casi todo el texto es diálogo: dos personas hablan el mismo idioma y no se entienden en absoluto, porque una razona como un tribunal y la otra como una aldea. Chéjov, que había ejercido de médico rural, conocía de primera mano ese desencuentro.",
    ru: "Появился в 1885 году в «Петербургской газете». Это допрос, и почти весь текст — диалог: двое говорят на одном языке и совершенно не понимают друг друга, потому что один рассуждает как суд, а другой как деревня. Чехов, работавший земским врачом, знал это расхождение не понаслышке. Толстой называл этот рассказ в числе лучших у Чехова.",
  },
  "Пересолил": {
    level: "B1",
    es: "Relato de 1885 de la etapa de «Oskolki». Su chiste es puramente lingüístico y por eso funciona bien para quien aprende ruso: el verbo del título significa literalmente «echar demasiada sal» y en sentido figurado «exagerar», y el cuento vive entero dentro de esa doble lectura. Chéjov usaba a menudo este recurso en los años de «Oskolki»: un título que ya contiene el chiste del relato.",
    ru: "Рассказ 1885 года, из поры «Осколков». Его шутка чисто языковая, и потому он хорошо ложится на изучающего русский: глагол в заглавии буквально значит «положить слишком много соли», а в переносном смысле — «переборщить», и весь рассказ живёт внутри этого двойного чтения. В пору «Осколков» Чехов часто так и делал: заглавие уже содержало шутку всей вещи.",
  },
  "Хирургия": {
    level: "B2",
    es: "De 1884, escrito cuando Chéjov acababa de terminar la carrera de medicina. Ejerció de médico toda su vida y decía que la medicina era su mujer legítima y la literatura su amante. Este relato es de los pocos donde escribe desde dentro de la profesión, y el humor nace de saber exactamente cómo transcurre una consulta.",
    ru: "1884 год, написан, когда Чехов только закончил медицинский факультет. Врачом он оставался всю жизнь и говорил, что медицина — его законная жена, а литература — любовница. Это один из немногих его рассказов, написанных изнутри профессии, и юмор здесь рождается из точного знания, как идёт приём. Действие происходит в земской больнице — в той самой системе сельской медицины, где он и работал.",
  },
  "Ванька": {
    level: "B2",
    es: "Publicado en 1886 como «святочный рассказ», el género navideño que la prensa rusa encargaba cada diciembre y que solía exigir un final consolador. Chéjov aceptó el encargo y el marco festivo, pero no la consolación obligatoria, y por eso el relato incomodó desde el primer momento. La escena que lo cierra depende por entero de un detalle práctico del correo ruso de la época.",
    ru: "Напечатан в 1886 году как святочный рассказ — рождественский жанр, который русские газеты заказывали каждый декабрь и который обычно требовал утешительного финала. Чехов заказ и праздничную рамку принял, а обязательное утешение — нет, и потому рассказ смущал читателя с самого начала. Финальная сцена целиком держится на одной бытовой подробности тогдашней русской почты.",
  },
  "Тоска": {
    level: "B2",
    es: "De 1886. Chéjov le puso como epígrafe una línea de un salmo eslavo eclesiástico —«¿A quién contaré mi pena?»—, y esa pregunta organiza todo el relato. La palabra del título es célebre por no tener equivalente exacto en otras lenguas: no es tristeza ni aburrimiento, sino algo entre las dos. El relato es de los más citados cuando se habla de la soledad en la ciudad grande.",
    ru: "1886 год. Эпиграфом Чехов поставил строку из церковнославянского псалма — «Кому повем печаль мою?», — и этот вопрос держит весь рассказ. Само слово в заглавии знаменито тем, что не имеет точного соответствия в других языках: это не грусть и не скука, а нечто между ними. Рассказ — один из самых цитируемых, когда говорят об одиночестве в большом городе.",
  },
  "Дама с собачкой": {
    level: "B2",
    es: "Escrito en 1899 en Yalta, donde Chéjov vivía ya por prescripción médica a causa de la tuberculosis, y publicado ese mismo año en «Rússkaya mysl». La ciudad no es un decorado cualquiera: Yalta era el balneario del imperio, un sitio de temporada donde la gente llegaba sin su vida habitual detrás. Chéjov pasó allí sus últimos años y construyó la casa que hoy es su museo.",
    ru: "Написан в 1899 году в Ялте, где Чехов уже жил по предписанию врачей из-за туберкулёза, и в том же году напечатан в «Русской мысли». Город здесь не случайная декорация: Ялта была курортом империи, сезонным местом, куда приезжали, оставив привычную жизнь позади. Чехов провёл там последние годы и построил дом, в котором сегодня его музей.",
  },
  "Скрипка Ротшильда": {
    level: "C1",
    es: "Publicado en 1894 en «Rússkie védomosti», ya en el Chéjov maduro. El relato hace convivir dos oficios y dos comunidades de una misma ciudad de provincias, la rusa y la judía, en unos años en que esa vecindad era cualquier cosa menos neutral. Shostakóvich lo tenía por uno de los textos más musicales de la prosa rusa.",
    ru: "Напечатан в 1894 году в «Русских ведомостях» — это уже зрелый Чехов. Рассказ сводит два ремесла и две общины одного уездного города, русскую и еврейскую, в годы, когда такое соседство было каким угодно, только не нейтральным. Ученик Шостаковича Вениамин Флейшман начал писать по рассказу оперу, и Шостакович закончил её после гибели ученика на фронте.",
  },

  // ——— А.С. Пушкин ———
  "Сказка о рыбаке и рыбке": {
    level: "B1",
    es: "Pushkin la escribió en 1833, durante el otoño en su finca de Boldino, la temporada más productiva de su vida. El argumento no es ruso de origen: viene de un cuento pomerano que los hermanos Grimm habían recogido en alemán, y Pushkin lo trasladó a verso ruso con un metro imitado del canto popular. Es el único de sus cuentos escrito sin rima.",
    ru: "Пушкин написал её в 1833 году, болдинской осенью — в самый плодовитый период своей жизни. Сюжет по происхождению не русский: он идёт от померанской сказки, записанной по-немецки братьями Гримм, и Пушкин переложил его русским стихом, размером, подражающим народной песне. Это единственная из его сказок, написанная без рифмы.",
  },
  "У лукоморья дуб зелёный": {
    level: "B2",
    es: "No es un poema independiente, sino el prólogo del poema «Ruslán y Liudmila»: Pushkin lo añadió en la segunda edición, de 1828, ocho años después de la primera. Funciona como un inventario de todas las criaturas del cuento popular ruso reunidas en unos pocos versos, y por eso es de los fragmentos que más se aprenden de memoria en la escuela.",
    ru: "Это не отдельное стихотворение, а пролог к поэме «Руслан и Людмила»: Пушкин добавил его во втором издании 1828 года, через восемь лет после первого. Он работает как перечень всех существ русской народной сказки, собранных в несколько строк, и потому остаётся одним из самых заучиваемых наизусть школьных отрывков.",
  },
  "Барышня-крестьянка": {
    level: "C1",
    es: "Cierra «Los relatos de Belkin», el ciclo que Pushkin escribió en el otoño de Boldino de 1830 y publicó en 1831 atribuyéndolo a un tal Belkin, un hacendado de provincias inventado. Fue su primera prosa terminada, y el ciclo entero juega con los clichés literarios de la época en vez de tomárselos en serio.",
    ru: "Завершает «Повести Белкина» — цикл, написанный Пушкиным болдинской осенью 1830 года и напечатанный в 1831-м под именем выдуманного провинциального помещика Белкина. Это была его первая законченная проза, и весь цикл играет с литературными штампами эпохи, а не принимает их всерьёз. Эта повесть — самая лёгкая по тону из пяти и чаще других попадает в учебники.",
  },

  // ——— И.А. Крылов ———
  "Ворона и Лисица": {
    level: "B1",
    es: "Krylov la publicó en 1808. El argumento venía de Esopo a través de La Fontaine, y Krylov lo tradujo tan libremente que dejó de ser una traducción: cambió el tono, metió giros coloquiales rusos y versos de longitud desigual. Varias de sus líneas se usan hoy en ruso como refranes, sin que quien las dice recuerde de dónde salen.",
    ru: "Крылов напечатал её в 1808 году. Сюжет пришёл от Эзопа через Лафонтена, и Крылов перевёл его так вольно, что переводом это быть перестало: он сменил тон, ввёл русские разговорные обороты и строки неравной длины. Несколько его строк сегодня живут в русском как поговорки, и говорящий обычно не помнит их источника.",
  },
  "Стрекоза и Муравей": {
    level: "B1",
    es: "También de 1808 y también tomada de La Fontaine. Guarda una curiosidad de traducción: en el original francés y en Esopo el insecto era una cigarra, pero en la Rusia del norte la cigarra no se conoce, y Krylov puso en su lugar un insecto de verano familiar para su lector. El nombre ruso quedó fijado por la fábula, no por la zoología.",
    ru: "Тоже 1808 год и тоже взято у Лафонтена. Здесь есть переводческий курьёз: во французском оригинале и у Эзопа насекомое — цикада, но на севере России цикада неизвестна, и Крылов подставил летнее насекомое, знакомое его читателю. Русское название закрепила басня, а не зоология. Крылов написал больше двухсот басен, а школьная программа держится на десятке из них.",
  },

  // ——— Прочая русская классика ———
  "Воробей": {
    level: "B2",
    es: "Pertenece a los «Poemas en prosa», la serie breve que Turguénev escribió ya anciano y enfermo en Francia y publicó en 1882, un año antes de morir. Son textos de una o dos páginas, sin argumento, a medio camino entre el poema y la anotación de diario: una forma que en la literatura rusa prácticamente inauguró él.",
    ru: "Входит в «Стихотворения в прозе» — короткий цикл, который Тургенев писал уже стариком и больным во Франции и напечатал в 1882 году, за год до смерти. Это тексты в страницу-другую, без сюжета, на полпути между стихотворением и дневниковой записью: форма, которую в русской литературе фактически открыл он.",
  },
  "Муму": {
    level: "C1",
    es: "Turguénev lo escribió en 1852 estando arrestado en Petersburgo por publicar un obituario de Gógol, y se publicó en 1854. El material es autobiográfico y muy incómodo: la casa que describe es la de su propia madre, una terrateniente de carácter despótico, y el relato es una de las acusaciones más directas contra la servidumbre escritas antes de su abolición.",
    ru: "Тургенев написал его в 1852 году под арестом в Петербурге — за напечатанный некролог Гоголю, — а вышел рассказ в 1854-м. Материал автобиографический и очень неудобный: описанный дом — дом его собственной матери, помещицы деспотического нрава, а сам рассказ стал одним из самых прямых обвинений крепостному праву, написанных до его отмены.",
  },
  "Данко": {
    level: "B2",
    es: "No es un relato independiente: es una leyenda que un personaje cuenta dentro de «La vieja Izerguil», de Maxim Gorki, publicado en 1895. Ese cuento encierra tres historias contadas por una anciana, y esta es la última. En la época soviética se extrajo del marco y se enseñó por separado en la escuela, que es como la conoce hoy la mayoría.",
    ru: "Это не самостоятельный рассказ, а легенда, которую персонаж рассказывает внутри «Старухи Изергиль» Максима Горького, напечатанной в 1895 году. Тот рассказ вмещает три истории из уст старухи, и эта — последняя. В советское время её извлекли из рамки и стали проходить в школе отдельно; так её и знает сегодня большинство.",
  },
  "Куст сирени": {
    level: "B2",
    es: "Relato temprano de Kuprín, de 1894, escrito cuando acababa de dejar el ejército y vivía de colaboraciones en prensa. Es una historia de matrimonio contada desde un ángulo poco habitual en la literatura rusa del XIX: el mérito no está en el hombre que estudia, sino en la mujer que resuelve. Kuprín llegó tarde a la literatura y trabajó antes de actor, pescador y dentista, entre otros oficios.",
    ru: "Ранний рассказ Куприна, 1894 год, написан вскоре после ухода из армии, когда он жил газетными публикациями. Это история супружества, рассказанная с непривычного для русской литературы XIX века угла: заслуга не у мужа, который учится, а у жены, которая находит выход. Куприн пришёл в литературу поздно и успел поработать актёром, рыбаком и зубным врачом.",
  },
  "Чудесный доктор": {
    level: "C1",
    es: "Relato navideño de Kuprín, de 1897. El autor afirmaba que no lo inventó, sino que se lo contaron como sucedido, y el médico del título tiene un original real: Nikolái Pirogov, cirujano célebre y figura casi legendaria de la medicina rusa del siglo XIX. Es de los pocos «святочные рассказы» del género que se siguen leyendo hoy.",
    ru: "Святочный рассказ Куприна, 1897 год. Автор уверял, что не выдумал его, а услышал как о случившемся, и у доктора из заглавия есть реальный прототип — Николай Пирогов, знаменитый хирург и почти легендарная фигура русской медицины XIX века. Это один из немногих святочных рассказов жанра, которые читают до сих пор.",
  },
  "Тёмные аллеи": {
    level: "B2",
    es: "Da título al ciclo que Bunin escribió en Grasse, en el sur de Francia, durante la ocupación alemana, y publicó en 1943 ya en la emigración. Bunin, primer ruso que recibió el Nobel de literatura, consideraba este libro lo mejor que había hecho. El título viene de un verso de Nikolái Ogariov que se cita dentro del propio relato.",
    ru: "Даёт название циклу, который Бунин писал в Грассе на юге Франции во время немецкой оккупации и напечатал в 1943 году уже в эмиграции. Бунин, первый русский лауреат Нобелевской премии по литературе, считал эту книгу лучшим, что он сделал. Заглавие взято из строки Николая Огарёва, которая цитируется внутри самого рассказа.",
  },
  "Лапти": {
    level: "C1",
    es: "Texto breve de Bunin de 1924, de sus primeros años de emigración en Francia. El objeto del título son los zapatos de tira de tilo que calzaba el campesinado ruso: baratos, de duración muy corta, y por eso mismo un símbolo directo de pobreza. Bunin escribía entonces sobre una Rusia rural que ya sabía que no volvería a ver.",
    ru: "Короткий текст Бунина 1924 года, из первых лет эмиграции во Франции. Предмет в заглавии — обувь из липового лыка, которую носило русское крестьянство: дешёвая, снашивавшаяся очень быстро и потому прямой знак бедности. Бунин писал тогда о деревенской России, которую, как он уже понимал, больше не увидит.",
  },
  "Левша": {
    level: "C1",
    es: "Su título completo es «Relato del bizco zurdo de Tula y de la pulga de acero», y Leskov lo publicó en 1881. Está escrito en «сказ»: no en la lengua del autor, sino imitando la de un narrador popular, con palabras extranjeras deformadas a oído. Esa lengua inventada es la razón de que sea casi intraducible y de que en ruso se lea como un clásico.",
    ru: "Полное название — «Сказ о тульском косом левше и о стальной блохе», Лесков напечатал его в 1881 году. Написан он сказом: не языком автора, а с подражанием речи народного рассказчика, с иностранными словами, перевранными на слух. Этот выдуманный язык и делает вещь почти непереводимой, а по-русски — классикой.",
  },
  "Ночь перед Рождеством": {
    level: "C1",
    es: "De «Veladas en un caserío cerca de Dikanka», el libro con el que Gógol, ucraniano de nacimiento, se dio a conocer en San Petersburgo en 1831–1832. Mezcla folclore ucraniano, demonología popular y humor de aldea. Rimski-Kórsakov hizo con él una ópera, y el relato es lectura de temporada en Rusia cada diciembre.",
    ru: "Из «Вечеров на хуторе близ Диканьки» — книги, которой Гоголь, украинец по рождению, заявил о себе в Петербурге в 1831–1832 годах. В ней смешаны украинский фольклор, народная демонология и деревенский юмор. Римский-Корсаков написал по повести оперу, а сам текст в России каждый декабрь читают как сезонный.",
  },
  "Повесть о том, как один мужик двух генералов прокормил": {
    level: "C1",
    es: "Saltykov-Shchedrín la publicó en 1869 en «Otéchestvennye zapiski», dentro de la serie de «cuentos» satíricos con que rodeó la censura: la forma de fábula permitía decir sobre el funcionariado y el orden social lo que un artículo directo no habría pasado. El humor es deliberadamente absurdo y la crítica, muy concreta.",
    ru: "Салтыков-Щедрин напечатал её в 1869 году в «Отечественных записках», в ряду сатирических «сказок», которыми он обходил цензуру: сказочная форма позволяла сказать о чиновничестве и общественном устройстве то, чего не пропустили бы в прямой статье. Юмор здесь нарочито абсурдный, а критика — вполне конкретная.",
  },
};

/** The note for a story, in the page's language, or null if there is
 * none — which is the normal case: 285 of the 325 stories have no note,
 * either because they are RusoFácilapp originals or because they are
 * inside the frozen experiment. */
export function getCulturalNote(
  story: { title: string; level: string },
  lang: "es" | "ru",
): string | null {
  const note = NOTES[story.title];
  if (!note || note.level !== story.level) return null;
  return lang === "ru" ? note.ru : note.es;
}

/** Titles carrying a note. Exported for the regression test, which uses
 * it to assert that no frozen story ever appears here. */
export const CULTURAL_NOTE_TITLES = Object.keys(NOTES);
