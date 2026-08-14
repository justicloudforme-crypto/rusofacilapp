import type { LessonContent } from "./types";

export type ValidationResult =
  | { valid: true; content: LessonContent }
  | { valid: false; error: string };

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Exported so src/lib/exams/validate.ts can validate exam exercises with
 * the exact same rules instead of duplicating this switch — an exam's
 * skill-area exercises are the same Exercise union as a lesson's. */
export function validateExercise(exercise: unknown, index: number): string | null {
  if (typeof exercise !== "object" || exercise === null) {
    return `exercises[${index}] debe ser un objeto`;
  }
  const e = exercise as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id) return `exercises[${index}].id falta o no es texto`;
  if (e.explanation !== undefined && typeof e.explanation !== "string")
    return `exercises[${index}].explanation debe ser texto`;

  switch (e.type) {
    case "multiple-choice":
      if (typeof e.prompt !== "string" || !e.prompt)
        return `exercises[${index}].prompt falta`;
      if (!isStringArray(e.options) || e.options.length < 2)
        return `exercises[${index}].options debe tener al menos 2 textos`;
      if (
        typeof e.correctIndex !== "number" ||
        e.correctIndex < 0 ||
        e.correctIndex >= (e.options as string[]).length
      )
        return `exercises[${index}].correctIndex debe apuntar a una opción válida`;
      return null;

    case "fill-blank":
      if (typeof e.before !== "string" || typeof e.after !== "string")
        return `exercises[${index}].before/after deben ser texto`;
      if (!isStringArray(e.answers) || e.answers.length === 0)
        return `exercises[${index}].answers debe tener al menos una respuesta`;
      return null;

    case "matching": {
      if (!Array.isArray(e.pairs) || e.pairs.length < 2)
        return `exercises[${index}].pairs debe tener al menos 2 pares`;
      const badPair = e.pairs.some(
        (pair) =>
          typeof pair !== "object" ||
          pair === null ||
          typeof (pair as Record<string, unknown>).left !== "string" ||
          typeof (pair as Record<string, unknown>).right !== "string"
      );
      if (badPair) return `exercises[${index}].pairs debe tener { left, right } de texto`;
      return null;
    }

    case "word-reorder":
      if (typeof e.prompt !== "string" || !e.prompt)
        return `exercises[${index}].prompt falta`;
      if (!isStringArray(e.words) || e.words.length < 2)
        return `exercises[${index}].words debe tener al menos 2 palabras`;
      if (e.translation !== undefined && typeof e.translation !== "string")
        return `exercises[${index}].translation debe ser texto`;
      return null;

    case "listening":
      if (typeof e.audioText !== "string" || !e.audioText)
        return `exercises[${index}].audioText falta`;
      if (typeof e.prompt !== "string" || !e.prompt)
        return `exercises[${index}].prompt falta`;
      if (!isStringArray(e.options) || e.options.length < 2)
        return `exercises[${index}].options debe tener al menos 2 textos`;
      if (
        typeof e.correctIndex !== "number" ||
        e.correctIndex < 0 ||
        e.correctIndex >= (e.options as string[]).length
      )
        return `exercises[${index}].correctIndex debe apuntar a una opción válida`;
      return null;

    case "reading-comprehension": {
      if (typeof e.text !== "string" || !e.text)
        return `exercises[${index}].text falta`;
      if (!Array.isArray(e.questions) || e.questions.length === 0)
        return `exercises[${index}].questions debe tener al menos una pregunta`;
      for (let qi = 0; qi < e.questions.length; qi++) {
        const q = e.questions[qi] as Record<string, unknown>;
        if (typeof q !== "object" || q === null || typeof q.prompt !== "string" || !q.prompt)
          return `exercises[${index}].questions[${qi}].prompt falta`;
        if (!isStringArray(q.options) || q.options.length < 2)
          return `exercises[${index}].questions[${qi}].options debe tener al menos 2 textos`;
        if (
          typeof q.correctIndex !== "number" ||
          q.correctIndex < 0 ||
          q.correctIndex >= (q.options as string[]).length
        )
          return `exercises[${index}].questions[${qi}].correctIndex debe apuntar a una opción válida`;
        if (q.explanation !== undefined && typeof q.explanation !== "string")
          return `exercises[${index}].questions[${qi}].explanation debe ser texto`;
      }
      return null;
    }

    case "listening-transcription":
      if (typeof e.audioText !== "string" || !e.audioText)
        return `exercises[${index}].audioText falta`;
      if (typeof e.prompt !== "string" || !e.prompt)
        return `exercises[${index}].prompt falta`;
      if (!isStringArray(e.acceptedAnswers) || e.acceptedAnswers.length === 0)
        return `exercises[${index}].acceptedAnswers debe tener al menos una respuesta`;
      return null;

    default:
      return `exercises[${index}].type debe ser multiple-choice, fill-blank, matching, word-reorder, listening, reading-comprehension o listening-transcription`;
  }
}

const SLIDE_ICON_KEYS = new Set([
  "star",
  "book",
  "ear",
  "chat",
  "warning",
  "compare",
  "house",
  "graduation",
  "wave",
  "handshake",
  "people",
  "badge",
  "exchange",
  "farewell",
  "structureCompare",
  "casesWheel",
  "safeStart",
  "genderTrio",
  "wordCards",
  "template",
  "numberGrid",
  "numberBuild",
  "priceTag",
  "rubleCount",
  "clockFace",
  "hourCount",
  "orderBubble",
  "verbConjugation",
  "permissionAsk",
  "shopShelf",
  "receipt",
  "foodCards",
  "familyTree",
  "possessPhrase",
  "adjectiveGender",
  "adjectivePair",
  "wordOrderFamily",
  "extendedFamily",
  "verbEndings",
  "rootSwap",
  "formalityMap",
  "dualMeaning",
  "negationMark",
  "workConjugation",
  "cityWords",
  "whereQuestion",
  "directionArrows",
  "politeAsk",
  "imperativeWalk",
  "nearBetween",
  "imperativeTyForm",
  "imperativeVyForm",
  "suffixTrio",
  "negativeImperative",
  "politeCommand",
  "commandCards",
  "modalWant",
  "modalCan",
  "modalInfinitive",
  "canQuestion",
  "modalNegation",
  "actionVerbCards",
  "wantVsCan",
  "prepositionalMasc",
  "prepositionalFem",
  "vNaCompare",
  "endingGrid",
  "whereDialogue",
  "placeCards",
  "transportGrid",
  "edatConjugation",
  "transportEndings",
  "indeclinableWords",
  "naChemDialogue",
  "transportCards",
  "accusativeGrid",
  "accusativeFemEnding",
  "accusativeUnchanged",
  "accusativeAnimate",
  "accusativePronouns",
  "accusativeDialogue",
  "directionGrid",
  "idtiConjugation",
  "staticVsDirection",
  "accusativeDirectionEndings",
  "domoyHome",
  "kudaDialogue",
  "pastFormation",
  "pastGenderAgreement",
  "pastByt",
  "pastNegation",
  "pastDialogue",
  "pastMoreVerbs",
  "futureVocab",
  "aspectPairs",
  "futureByt",
  "perfectiveFormation",
  "futureNegation",
  "futureDialogue",
  "possessionGrid",
  "genitivePronounsFull",
  "estContrast",
  "possessionOmitEst",
  "negationGenitiveShift",
  "possessionDialogue",
  "clockGrid",
  "hourNumberAgreement",
  "dayPartsInstrumental",
  "halfAndQuarter",
  "atTimeConstruction",
  "timeDialogue",
  "weekCycle",
  "monthsGrid",
  "daysAccusative",
  "monthsPrepositional",
  "dayMonthCompare",
  "calendarDialogue",
  "dateVocab",
  "ordinalNominativeTable",
  "ordinalGenitiveShift",
  "monthAlwaysGenitive",
  "spanishDateCompare",
  "dateDialogue",
  "genitiveVocabGrid",
  "genitiveMascNeutEndings",
  "genitiveFemEndings",
  "negativePronouns",
  "genitiveLocationExistence",
  "genitiveDialogue",
  "quantityVocabGrid",
  "oneGenderAgreement",
  "twoGenderSplit",
  "numeralCaseTable",
  "genitivePluralFormation",
  "quantityWords",
  "quantityDialogue",
  "originVocabGrid",
  "possessionNoPreposition",
  "chiyQuestion",
  "izVsOt",
  "vNaIzSPairing",
  "originDialogue",
  "extendedFamilyGenitive",
  "dativePronounsFull",
  "ageConstruction",
  "ageNumberAgreement",
  "teenNumbersException",
  "spanishDativeCompare",
  "nounDativeGlimpse",
  "ageDialogue",
  "feelingsVocabGrid",
  "nravitsyaAgreement",
  "spanishGustarCompare",
  "nravitsyaVsLyubit",
  "impersonalStateWords",
  "negationNravitsya",
  "feelingsDialogue",
  "professionsVocabGrid",
  "instrumentalMascEndings",
  "instrumentalFemEndings",
  "nominativeVsInstrumental",
  "bytPastInstrumental",
  "spanishComoDeCompare",
  "professionsDialogue",
  "sVocabGrid",
  "sPrepositionRule",
  "instrumentalPronounsFull",
  "sBecomesSoRule",
  "withWhomQuestion",
  "socialVerbsCards",
  "spanishConCompare",
  "withDialogue",
  "restaurantVocabGrid",
  "zakazatAccusative",
  "politeImperativeRequests",
  "restaurantDialogue",
  "hotelVocabGrid",
  "uVasEstConstruction",
  "durationAccusative",
  "spanishServiceCompare",
  "hotelDialogue",
  "streetVocabGrid",
  "politeDirectionsAsk",
  "turnImperativeTable",
  "throughAccusative",
  "farNearFromGenitive",
  "landmarkPrepositions",
  "turnOrdinals",
  "spanishDirectionsCompare",
  "directionsDialogue",
  "airportVocabGrid",
  "nuzhenAgreement",
  "nuzhenDativeConstruction",
  "doGenitiveDestination",
  "zaAccusativeGratitude",
  "airportProcessVocab",
  "spanishNecesitoCompare",
  "courseCompletionBadge",
  "airportDialogue",
  "aspectConceptCompare",
  "aspectPrefixFormation",
  "aspectPairsTableA2",
  "aspectPastMeaning",
  "aspectFutureConjugation",
  "aspectQuestionTest",
  "spanishAspectCompare",
  "aspectDialogue",
  "pastGenderAgreementFullTable",
  "neBiloImpersonalNegation",
  "futureAspectRecap",
  "sequencingAdverbsGrid",
  "narratingSequence",
  "spanishSerEstarCompare",
  "bytFullConjugationTable",
  "pastFutureDialogue",
  "genAccDecisionTree",
  "genAccVocabGridBook",
  "animateAccusativeDeepDive",
  "spanishPersonalACompare",
  "genitivePrepositionsRecap",
  "sameSentenceBothCases",
  "numeralsGenitiveRecap",
  "casesDialogue",
  "seasonsVocabGrid",
  "impersonalWeatherConstruction",
  "spanishHacerCompare",
  "weatherVerbsIdti",
  "seasonsInstrumentalReveal",
  "weatherVocabExpanded",
  "weatherComparatives",
  "weatherDialogue",
  "idtiVsEkhatRecap",
  "motionVerbPrefixTable",
  "prefixMeaningBreakdown",
  "spanishMotionVerbsCompare",
  "scheduleVocabConstruction",
  "ticketBuyingPhrases",
  "transportVocabExpanded",
  "travelDialogue",
  "houseRoomsVocabGrid",
  "moreRoomsVocabGrid",
  "furnitureVocabGrid",
  "vNaHouseDistinction",
  "addressConstruction",
  "nearbyPrepositionsCompare",
  "spanishEnCompare",
  "houseDialogue",
  "comparativeSuffixFormation",
  "compoundComparativeMore",
  "irregularComparativesTable",
  "superlativeSamyi",
  "chemVsGenitiveCompare",
  "opinionPhrasesGrid",
  "spanishMasQueCompare",
  "comparisonDialogue",
  "moreBodyPartsGrid",
  "bolitSingularPlural",
  "spanishDuelerCompare",
  "boletAspectPair",
  "symptomsVocabGrid",
  "feelingBadConstruction",
  "doctorAdviceImperatives",
  "healthDialogue",
  "adjGenEndingsTable",
  "possessivePronounDeclineTable",
  "egoEyoIkhInvariable",
  "spanishPossessiveCompare",
  "pluralGenAdjEnding",
  "genitiveContextsRecap",
  "comparisonWithGenitive",
  "possessionGenitiveDialogue",
  "dativeMascNeutAdjEndings",
  "dativeFemAdjEndings",
  "possessiveDativeTable",
  "egoEyoIkhDativeInvariable",
  "dativeGoverningVerbsGrid",
  "spanishIndirectObjectCompare",
  "dativePluralAdjEnding",
  "dativeAdjDialogue",
  "instrumentalMascNeutAdjEndings",
  "instrumentalFemAdjEndings",
  "possessiveInstrumentalTable",
  "egoEyoIkhInstrumentalInvariable",
  "sMnoyPronounsRecap",
  "spanishConmigoCompare",
  "bytStatInstrumentalAdjective",
  "instrumentalAdjDialogue",
  "genitiveDefaultPrepositionsGrid",
  "instrumentalSpatialPrepositions",
  "dativeExceptionPrepositions",
  "complexPrepositionDecisionRule",
  "spanishFixedPrepositionCompare",
  "prepositionCaseTableFull",
  "prepositionSentenceExamples",
  "prepositionDialogue",
  "sixCaseQuestionWordsTable",
  "sixCaseEndingChainDemo",
  "caseTriggerPrepositionsRecap",
  "verbGovernedCasesRecap",
  "spanishNoCasesCompare",
  "wordOrderFlexibilityDemo",
  "readingStrategyDiagram",
  "allCasesDialogue",
  "unidirectionalVsMultidirectionalCompare",
  "idtiKhoditConjugationTable",
  "motionDecisionTest",
  "pastTenseIdtiKhoditNuance",
  "prefixedMotionVerbsPreview",
  "imperativeMotionVerbs",
  "spanishSingleIrCompare",
  "onFootOnlyDisclaimer",
  "runningVerbsUnidirMultidirCompare",
  "begatBezhatConjugationTable",
  "begatBezhatIrregularStemNote",
  "prefixedRunningVerbsPreview",
  "imperativeRunningVerbs",
  "spanishCorrerSingleVerbCompare",
  "motionVerbPatternBridge",
  "runningDialogue",
  "vehicleVsWalkingMotionCompare",
  "yekhatYezditConjugationTable",
  "vehicleMotionDecisionTest",
  "pastTenseYekhatYezditNuance",
  "prefixedVehicleMotionVerbsPreview",
  "irregularImperativeYekhat",
  "spanishVehicleMotionCompare",
  "vehicleMotionDialogue",
  "threeMoreMotionPairsOverview",
  "letatLetetConjugationTable",
  "plavatPlytConjugationTable",
  "nositNestiConjugationTable",
  "nositWearMeaningExtension",
  "prefixedThreeMotionVerbsPreview",
  "spanishLlevarSingleVerbCompare",
  "threeVerbsDialogue",
  "sixMotionPairsFullRecap",
  "motionVerbChoiceBySituation",
  "sixPairsPrefixMultiplicationTable",
  "narrativePastAllSixVerbs",
  "dialoguePracticeWalkthrough",
  "spanishSingleIrVsSixVerbsCompare",
  "commonMistakesMotionVerbs",
  "motionVerbsStoryDialogue",
  "comparativeRecapBridge",
  "consonantMutationComparativesTable",
  "moreConsonantMutationExamples",
  "intensifiersMasVsPoco",
  "neverUseOchenComparative",
  "chemTemConstruction",
  "neTakoyKakConstruction",
  "comparativesDialogue",
  "adjVsAdvComparativeSameForm",
  "adjVsAdvDisambiguationTest",
  "adverbComparativeIrregularsRecap",
  "vsekhSuperlativeConstruction",
  "spanishMenteVsRussianCompare",
  "adverbComparativeVocabGrid",
  "commonMistakesAdvComparative",
  "adverbComparativeDialogue",
  "superlativeRecapBridge",
  "luchshiyKhudshiyDeclensionTable",
  "naiPrefixLiteraryForms",
  "izVsemGenitiveConstruction",
  "odinIzSamykhConstruction",
  "neverSamyyPlusComparative",
  "spanishIsimoVsSamyyCompare",
  "superlativeDialogue",
  "equalityRecapBridge",
  "takoyZheKakConstruction",
  "takVsTakoyDisambiguation",
  "odinakovoAlternative",
  "negationOfEquality",
  "vsyoComparativeGradualChange",
  "spanishCadaVezCompare",
  "equalityDialogue",
  "neopredelennieMestoimeniyaGrid",
  "ktoChtoToDeclensionTable",
  "kakoyToAdjectiveDeclension",
  "toAdverbsFamily",
  "cheyToPossessive",
  "toVsNibudSneakPeek",
  "spanishAlguienNoDeclineCompare",
  "indefinitePronounsDialogue",
  "nibudRecapBridge",
  "ktoChtoNibudDeclensionTable",
  "kakoyNibudDeclensionTable",
  "nibudUsageContexts",
  "liboFormalSynonym",
  "commonMistakeToInWrongContext",
  "nibudAdverbsFamily",
  "spanishNoToNibudDistinction",
  "negativePronounsA1RecapBridge",
  "niktoFullDeclensionTable",
  "nichtoFullDeclensionTable",
  "prepositionSplitRule",
  "nikakoyAdjectiveAgreement",
  "niOdinConstruction",
  "nichtoVsNichegoRegister",
  "spanishNegationPrepositionCompare",
  "adverbNegRecapBridge",
  "adverbFamilyFullGrid",
  "nikakConstruction",
  "niotkudaExtension",
  "fourWaySynthesisTable",
  "wordOrderFlexibility",
  "idiomaticNikogdaExpressions",
  "spanishNuncaCompare",
  "healthA2RecapBridge",
  "boletVsInstrumentalContrast",
  "illnessInstrumentalExamples",
  "medicalSpecialistsGrid",
  "appointmentBookingDialogue",
  "pharmacyVisitConstruction",
  "illnessDurationExpressions",
  "spanishRecetaParallelCompare",
  "clothingVocabGrid",
  "pluraleTantumClothing",
  "colorAdjectiveAgreement",
  "idyotVsMaloDistinction",
  "comparativeSizeRequest",
  "conditionalReturnConstruction",
  "obmenVsVozvratDistinction",
  "spanishQuedarCompare",
  "navigationWeatherRecapBridge",
  "weatherForecastFuture",
  "obeshchayutWeatherIdiom",
  "doPrefixArrivalVerbs",
  "gettingLostPhrases",
  "publicTransportWayfinding",
  "conditionalWeatherPlanning",
  "spanishPronosticoCompare",
  "physicalHeightBuildGrid",
  "hairEyesUGenitiveConstruction",
  "estNoEstNuanceForTraits",
  "faceFeaturesGlassesBeard",
  "characterVocabGrid",
  "intensifiersDovolnoScale",
  "comparativeSuperlativeCharacterReview",
  "spanishSerEstarTraitsCompare",
  "potomuChtoCauseConstruction",
  "takKakFormalCauseSynonym",
  "poetomuConsequenceConstruction",
  "khotyaConcessionConstruction",
  "nesmotryaNaToChtoFormalConcession",
  "causeConsequenceDiagram",
  "registerComparisonTable",
  "spanishConnectorsParallelCompare",
  "dativeIndirectObjectDeepen",
  "dativeImpersonalNeedModal",
  "dativeImpersonalStateAdjectives",
  "dativeAgeParadigmTable",
  "instrumentalProfessionStative",
  "instrumentalMeansTool",
  "instrumentalTimeExpressions",
  "spanishDativeInstrumentalCompare",
  "opinionIntroducersCompare",
  "agreementShortAdjectiveGender",
  "disagreementSoftenedConstruction",
  "hedgingUncertaintyWords",
  "oneHandOtherHandStructure",
  "agreeDisagreeHedgeSpectrum",
  "shortAdjectiveGenderPatternGeneral",
  "spanishOpinionAgreementCompare",
  "workingDayScheduleOverview",
  "sDoGenitiveTimeRange",
  "workplaceVocabGrid",
  "studyRoutineVocabGrid",
  "postuplitUchitsyaCompare",
  "sdavatSdatAspectPair",
  "zanimatsyaVsIzuchatCompare",
  "spanishWorkStudyRoutineCompare",
  "odnazhdyStoryOpener",
  "narrativeSequenceChain",
  "pokaVsKogdaBackground",
  "temVremenemParallelScene",
  "vdrugUnexpectedTwist",
  "accusativeDurationNoPreposition",
  "narrativeClosingCompare",
  "spanishNarrativeConnectorsCompare",
  "mediaLandscapeGrid",
  "mediaPeopleRoles",
  "reportingVerbsAspectPair",
  "poDativeSourceCitation",
  "chtoLightIndirectSpeechBridge",
  "headlineRegisterOmission",
  "broadcastFrequencyFormat",
  "spanishMediaVocabCompare",
  "russianCulturalSymbolsGrid",
  "skiyAdjectiveEndingPattern",
  "prinyatoImpersonalCustomConstruction",
  "prinyatoVsNuzhnoCompare",
  "orthodoxCalendarFestivals",
  "superstitionsAndPortentsList",
  "khlebSolHospitalityRitual",
  "maslenitsaWeekBlinyRitual",
  "formalEmailOpeningGreeting",
  "patronymicFormationPattern",
  "formalRequestPhrasesGrid",
  "vyCapitalizedWrittenRegister",
  "temaSubjectLineFormat",
  "neMogliByPoliteConditional",
  "formalClosingVariants",
  "spanishFormalEmailCompare",
  "priPrefixArrivalMeaning",
  "uPrefixDepartureMeaning",
  "prefixedAspectPunctualHabitual",
  "motionRootCombinationTable",
  "destinationOriginPrepositionTable",
  "priUImperativeForms",
  "farewellMissingVocabGroup",
  "spanishArriveLeaveCompare",
  "vPrefixEntryMeaning",
  "vyPrefixExitMeaning",
  "vyStressAlwaysOnPrefix",
  "voEuphonicInsertionRule",
  "entryExitPrepositionConsistency",
  "figurativeVIdiomsGroup",
  "vhoditVsVoshedAspectCompare",
  "spanishEntryExitCompare",
  "podPrefixApproachMeaning",
  "otPrefixDistancingMeaning",
  "podOtVsPriUCompare",
  "podOtVsVVyCompare",
  "socialApproachDistanceUsage",
  "podhoditFigurativeSuitable",
  "podOtAspectCompare",
  "spanishApproachDistanceCompare",
  "crossPrefixPhysicalMeaning",
  "cherezOptionalConstruction",
  "pereehatMudanzaFigurative",
  "pereStateChangeFigurativeGroup",
  "peresestTransferExchangeGroup",
  "motionPrefixBlockComparisonTable",
  "pereAspectCompare",
  "spanishCrossChangeCompare",
  "proPrefixPassByMeaning",
  "proPrefixFullDistanceMeaning",
  "doPrefixReachDestinationMeaning",
  "priVsDoCompare",
  "proFigurativeContinuityGroup",
  "doFigurativeAchievementGroup",
  "fullPrefixSystemReviewTable",
  "spanishPassReachCompare",
  "fullPrefixSystemDecisionTree",
  "priUReviewCompact",
  "vVyReviewCompact",
  "podOtReviewCompact",
  "pereProDoReviewCompact",
  "figurativeMotionVerbsGroup",
  "figurativeDerivedNounsGroup",
  "spanishManyVerbsVsOneSystemCompare",
  "aspectGeneralFactualMeaning",
  "aspectSuppletivePairsGroup",
  "aspectNarrativeSequenceChain",
  "aspectBackgroundEventContrast",
  "aspectCountedRepetitionPerfective",
  "aspectClassicContrastRevisited",
  "aspectPastUsesSummaryTable",
  "spanishPastAspectNuanceCompare",
  "futureCompoundSimpleReviewCompare",
  "futureNoPresentPerfectiveExplain",
  "futureHabitualVsSingleAction",
  "futureTemporalClauseContrastES",
  "futureSuppletivePairsBridge",
  "futurePromiseVsEffortRegister",
  "futureAspectSummaryTable",
  "spanishSubjunctiveVsRussianFutureCompare",
  "phaseVerbsAlwaysImperfective",
  "modalVerbsBothAspectsNuance",
  "mochSmochCapacityVsAttemptContrast",
  "hotetAspectNuanceGroup",
  "zabytZabyvatNegationHabitContrast",
  "achievementVerbsPerfectiveGroup",
  "infinitiveAspectDecisionSummaryTable",
  "spanishNoInfinitiveAspectCompare",
  "negationImperfectiveDefaultMeaning",
  "negationPerfectiveFailedAttempt",
  "negationPerfectiveUnmetExpectation",
  "repetitionHabitualVsCountedBridge",
  "niRazuEmphaticNegationGroup",
  "chutNeNearMissPerfectiveGroup",
  "negationRepetitionSummaryTable",
  "spanishNegationNoAspectChangeCompare",
  "presentActiveParticipleFormation",
  "pastActiveParticipleFormation",
  "aspectPastParticipleContrast",
  "participleAdjectiveAgreementTable",
  "participleCommaPlacementRules",
  "kotoryVsParticipleRegisterCompare",
  "lexicalizedParticiplesGroup",
  "spanishNoProductiveParticipleCompare",
  "passivePresentParticipleFormation",
  "passivePastParticipleFormationTable",
  "fullVsShortFormContrast",
  "shortFormResultativeStateGroup",
  "passiveInstrumentalAgentConstruction",
  "activeVsPassiveParticipleChoice",
  "lyubimyLexicalizedGroup",
  "spanishEstarSerParticipleCompare",
  "gerundImperfectiveFormationRule",
  "gerundReflexiveEndingRule",
  "gerundDefectiveVerbsGroup",
  "gerundCommaAlwaysRule",
  "gerundSameSubjectRule",
  "chekhovJokeSameSubjectViolation",
  "gerundVsSubordinateClauseFunction",
  "spanishGerundioCloseParallelCompare",
  "gerundPerfectiveFormationRule",
  "gerundPerfectiveRegisterVariants",
  "gerundItiExceptionRule",
  "gerundSequentialChainExample",
  "gerundSameSubjectCommaBridge",
  "participleVsGerundDisambiguation",
  "imperfectiveVsPerfectiveGerundContrast",
  "spanishCompoundGerundCompare",
  "indirectSpeechNoTenseBackshift",
  "indirectSpeechPronounShiftTable",
  "indirectSpeechDeicticAdverbShiftTable",
  "indirectSpeechCommaContrastES",
  "indirectSpeechReportingVerbsRegisterGroup",
  "chtoByVsChtoPreviewBridge",
  "indirectQuestionsPreviewBridge",
  "spanishUniversalQueVsRussianSplitCompare",
  "chtobyPastTenseIrrealisRule",
  "chtobySameSubjectInfinitiveException",
  "chtobyGoverningVerbsRegisterGroup",
  "chtobyNegationPlacement",
  "spanishSubjunctiveChtobyParallelCompare",
  "chtoVsChtobyDirectContrastTable",
  "gerundSameSubjectBridgeReview",
  "indirectQuestionsPreviewBridgeReprise",
  "indirectQuestionsWordKeptRule",
  "indirectQuestionsNoTenseBackshiftWordOrder",
  "liParticlePlacementRule",
  "liFocusShiftContrastGroup",
  "spanishSiInvariantPositionCompare",
  "questionReportingVerbsRegisterLadder",
  "indirectQuestionPeriodNotQuestionMarkRule",
  "indirectSpeechThreeWayDecisionTree",
  "kotoryGenderNumberFromAntecedentCaseFromRoleRule",
  "kotoryFullDeclensionTable",
  "kotoryAnimateAccusativeRule",
  "kotoryPrepositionAttachmentGrid",
  "cheyVsKotoryGenitivePossessiveCompare",
  "kotoryCommaMandatoryVsSpanishRestrictiveCompare",
  "kotoryVsParticipleSubjectOnlyRegisterBridge",
  "kotoryCaseSelfTestPrompt",
  "formalVyRegisterInterviewReview",
  "vladetVsZnatLanguageMasteryRegisterCompare",
  "genitiveExperienceQualificationConstruction",
  "hiringFiringVerbLadderVoiceContrast",
  "siConditionalFutureIndicativeVsSpanishSubjunctiveCompare",
  "fixedInterviewCollocationsGrid",
  "interviewQuestionPhraseBank",
  "informalVsFormalWorkRegisterBridgeReview",
  "instrumentalProfessionA1BridgeRecap",
  "chemTemComparativeConstructionRule",
  "chemTemSpanishCuantoMasParallelCompare",
  "postupatVNaFacultyPrepositionNuance",
  "russianDegreeLadderVsSpanishSystemCompare",
  "kandidatNaukDoktorNaukTwoTierDoctorateUnique",
  "specializirovatsyaNaPrepositionalRule",
  "careerAdvancementPoDativePhraseGroup",
  "ponravitsyaVsNravitsyaAspectReactionCompare",
  "ponravitsyaPastGenderAgreementTable",
  "proizvestiVpechatlenieNaAccusativeConstruction",
  "plotSummaryImpersonalConstructionsGroup",
  "osnovanNaShortParticipleBridgeReview",
  "simpleComparativeVsChemTemBridgeReview",
  "vZhanreGenitiveConstruction",
  "reviewToolkitSynthesisTable",
  "kakoyVsKakAdjectiveNounExclamativeChoiceRule",
  "kakoyGenderAgreementExclamativeTable",
  "spanishQueUniversalVsRussianKakoyKakSplitCompare",
  "intensifierAdverbLadderGroup",
  "chtoClauseAfterExclamationBridgeReview",
  "colloquialInterjectionRegisterLadder",
  "zhalStandaloneVsB12FullSentenceBridgeReview",
  "b1LevelSynthesisReviewToolkit",
  "b1CourtesyPreviewBridgeReview",
  "byPastTenseGenderOnlyNoPersonConjugation",
  "byUsesGroup",
  "byPositionMobilityFocusShift",
  "esliBiIrrealConditionalStructure",
  "spanishTwoConditionalTensesVsRussianSinglePastCompare",
  "chtobyVsByBothPastIrrealisMarkingBridge",
  "fixedByExpressionsGroup",
  "esliRealConditionNoByPresentFutureRule",
  "esliVsKogdaConditionVsTimeCompare",
  "toOptionalConsequenceMarkerRule",
  "esliPastRealConditionSpanishParallelCompare",
  "esliByVsEsliNoByIrrealVsRealSynthesisBridge",
  "priUsloviiVSluchaeFormalConditionalPhraseGroup",
  "generalTruthImperativeConsequenceGroup",
  "perfectivePresentFutureValueBridgeReview",
  "opinionAgreementB13BridgeReview",
  "formalArgumentEssaySkeletonStructure",
  "formalSequencingConnectorsLadder",
  "certaintyVerbsIndicativeNoSubjunctiveRule",
  "commaBeforeChtoOpinionClauseBridgeReview",
  "hotyaVsyoTakiSofteningConcessionStructure",
  "soglasenSTemChtoConstructionRule",
  "nelzyaNeSoglasitsyaDoubleNegativeEmphasisRule",
  "invertedWordOrderPoeticEmphasisRule",
  "newInformationSentenceFinalPositionRule",
  "archaicPoeticVocabularyPassiveRecognitionRule",
  "epitetMetaphoraSravneniyeOlitsetvoreniyeFourFigures",
  "metaphorVsSravneniyeComoParticleContrastRule",
  "participlesGerundsStylisticDensityBridgeReview",
  "literaryCommentaryFixedPhrasesRule",
  "moodToneVocabularyLightDarkContrastRule",
  "discourseParticlesNuVotZheVedOverviewTable",
  "zhePartikleEmphasisInsistenceRule",
  "toPartikleaHighlightingPointingRule",
  "fixedColloquialExpressionsBlockMeaningRule",
  "internetYouthSlangPassiveRecognitionWarning",
  "registerLadderColoquialNeutralFormalCompare",
  "korocheVObschemFormalPhraseLadderCompare",
  "colloquialFarewellReassurancePhrasesRule",
  "socialVocabularyThematicOverviewTable",
  "impersonalConstructionsSchitaetsyaGovoryatNablyudaetsyaRule",
  "causalPrepositionsIzZaVSvyazSVResultateTable",
  "sociologicalOpinionFormulasByMneniyuSTochkiZreniya",
  "publicOpinionConcernExpressionsRule",
  "growthDeclineVerbNounPairsTable",
  "verbalNounsFormalToneRule",
  "passiveSyaSocialProcessesBridgeReview",
  "businessVocabularyThematicOverviewTable",
  "professionalIntroductionFixedPhrasesRule",
  "meetingNegotiationPhrasesLadderTable",
  "courtePoliteDisagreementPozvolteNeSoglasitsyaRule",
  "vyFormalAddressBusinessObligatoryRule",
  "fixedBusinessCollocationsBlockTable",
  "meetingSummaryClosingPhrasesRule",
  "percentageGrowthBusinessStatsRule",
  "shortAdjectiveFormationMascFemNeutPlTable",
  "shortAdjectivePredicateOnlyNeverPrenominalRule",
  "shortOnlyAdjectivesRadDolzhenGotovSoglasenList",
  "shortVsLongAdjectiveMeaningContrastRule",
  "numeralNounAgreementOneTwoFourFiveTable",
  "numeralDeclensionByCaseTable",
  "compoundNumeralEachWordDeclinesRule",
  "shortAdjectiveBridgeReviewB120Participles",
  "relativeClauseToParticipleTransformationRule",
  "activeVsPassiveParticipleAgentAntecedentRule",
  "participleAgreesWithAntecedentNotMainSubjectRule",
  "passiveParticipleAgentToInstrumentalRule",
  "participleSubjectOnlyRestrictionRule",
  "participleFormationBridgeReviewB1920",
  "participleFormalRegisterVsKotoryColloquialRule",
  "relativeClauseParticipleTransformationTable",
  "gerundBridgeReviewB121B122Formation",
  "subordinateClauseToGerundAspectChoiceTable",
  "negativeNyeGerundCausalModalRule",
  "gerundInvariableVsParticipleAgreementContrastB29",
  "gerundSameSubjectRestrictionBridgeReview",
  "gerundChainSequentialActionsFormalNarrationRule",
  "movementVerbYtiGerundExceptionBridgeReview",
  "clauseGerundTransformationPracticeTable",
  "registerDensityScaleColloquialToBureaucraticTable",
  "kotoryPreferredColloquialParticipleFormalContrastReview",
  "participleAdjectivalVsGerundAdverbialFunctionContrastRule",
  "oneParticipleGerundPerClauseStyleRule",
  "bureaucraticStyleExtremeParticipialDensityExample",
  "participleGerundVisualSimilarityWarningRule",
  "registerAppropriateChoiceDecisionRule",
  "styleNaturalnessVsFormalityBalanceRule",
  "participleObligatorySubjectOnlyBridgeReviewB126B29",
  "participleVsKotoryBothPossibleStylisticChoiceRule",
  "multipleKotoryClausesSentenceOverloadExample",
  "participleCompactAdjacentPositionVsKotoryClauseRule",
  "kotoryAmbiguousAttachmentMultipleAntecedentsWarning",
  "kotoryVsParticipleDecisionFlowchartRule",
  "participleEnumerationListCompactStyleExample",
  "kotoryPreferredWhenClarityOverCompactnessRule",
  "passiveShortParticipleFormationBridgeReviewB120",
  "passiveShortParticipleTenseParadigmWasWillBeTable",
  "formalRegisterPassivePreferenceOverActiveRule",
  "passiveWithoutAgentOfficialNoticeRule",
  "newsLegalNoticeFormulaicPassiveExamplesTable",
  "shortAdjectiveShortParticipleParallelBridgeReviewB28",
  "longVsShortParticipleDescriptionVsResultBridgeReviewB120",
  "causalConnectorsBridgeReviewB11PotomuChtoTakKak",
  "poskolkuMostFormalThirdCausalConnectorRule",
  "causalConnectorFormalityLadderTable",
  "causalCommaPlacementFrontedVsMedialRule",
  "vedCausalReminderColloquialNuanceRule",
  "causalReasoningVocabularyTable",
  "formalCausalConstructionsPreviewBridgeB216",
  "concessiveBridgeReviewB11XotyaNesmotryaNaToChto",
  "nesmotryaNaAccusativeVsNesmotryaNaToChtoClauseRule",
  "vaprekiDativeVsNesmotryaNaAccusativeContrastTable",
  "concessiveCommaPlacementFrontedVsMedialRule",
  "advancedConcessiveExpressionsTable",
  "dazheEsliHypotheticalVsXotyaFactualConcessionRule",
  "concessiveConnectorVocabularyTable",
  "causalPrepositionVsClauseStructuralSplitBridgeReviewB26B214",
  "blagodarjaTomuChtoDativeVsIzZaTogoChtoGenitiveStructureTable",
  "causalConnotationLadderPositiveNeutralNegativeTable",
  "blagodarjaIronicNegativeCauseRule",
  "causalVerbsVyzvatPrivestiKObuslovitSpravotsirovatTable",
  "causalClauseCommaPlacementMedialVsFrontedRule",
  "causalReasoningExtendedVocabularyTable",
  "chtobySameSubjectInfinitiveDifferentSubjectPastBridgeReviewB124",
  "chtobyPurposeAdverbialVsB124ReportedWishComplementRule",
  "dljaTogoChtobyFormalEmphasisFrontingRule",
  "takChtoConsequenceNoObligatoryFormRule",
  "purposeVsConsequenceSameSituationContrastTable",
  "formalPurposeConsequenceRegisterVocabularyTable",
  "goalAchievementVocabularyTable",
  "motionVerbFigurativeBridgeReviewB114LiteralVsFigurativeMeaning",
  "doytiDoGenitiveReachingExtremeLimitTable",
  "vyitiIzGenitiveAbandoningStateTable",
  "pereytiThreeCaseStructuresVariationRule",
  "zaytiVAcusativeEnteringDeadEndRule",
  "prefixSemanticPatternDoVyPereZaSummaryTable",
  "figurativeIdiomExtendedPracticeVocabularyTable",
  "figurativeMotionVerbPartTwoBridgeReviewB114B218PrefixSplit",
  "priytiKDativeReachingMentalResultTable",
  "priytiVSebyaExceptionWithinPriytiKFamilyRule",
  "uytiOtGenitiveEvadingResponsibilityTable",
  "voytiVAcusativeAdoptingConditionTable",
  "poytiNaAcusativeAcceptingRiskSacrificeTable",
  "figurativePrefixPatternPriUVPoSummaryTable",
  "motionIdiomBridgeReviewB218VyitiZamuzhA216BezhatLiteral",
  "skhoditSUmaLiteralVsHyperbolicRule",
  "vestiSebyaReflexiveNeverOmittedRule",
  "naytiObshchiyYazykInstrumentalLiteralVsFigurativeRule",
  "vyitiZamuzhZaVsZhenitsyaNaGenderCaseContrastTable",
  "movementIdiomVocabularyTableOne",
  "movementIdiomVocabularyTableTwo",
  "byNiBridgeReviewB21B215PastTenseAndKakByToNiBylo",
  "interrogativeByNiUniversalityFamilyTable",
  "byNiAlwaysPastIrrealisLikeB21Rule",
  "voChtoByToNiStaloAbsoluteDeterminationRule",
  "kakNiStrannoVsChtoNiGovoriDiscourseContrastRule",
  "productiveGrammarPatternVsFixedLexicalIdiomB25ContrastTable",
  "byNiExtendedPracticeVocabularyTable",
  "scientificStyleBridgeReviewB111B213KancelyarskyAndShortParticiple",
  "syaReflexivePassiveHabitualVsShortParticiplePunctualRule",
  "syaVsShortParticipleExampleFormsTable",
  "otglagolnyeSushchestvitelnyeVerbalNounDensityRule",
  "scientificKancelyarizmyVSootvetstviiNaOsnovaniiVRamkakhTable",
  "avoidFirstPersonMyPassiveImpersonalPreferenceRule",
  "scientificResearchVocabularyTable",
  "writtenCorrespondenceBridgeReviewB27SpokenVsB25ColloquialWarning",
  "formalLetterStructureTable",
  "patronymicSaludoObligatoryRule",
  "introductionFormulasTable",
  "requestComplaintThanksFormulasTable",
  "closingFormulaAndB213ShortParticipleBridgeRule",
  "officialCorrespondenceVocabularyTable",
  "journalisticStyleBridgeReviewB124B26B212ThreeRegisterContrast",
  "headlineEconomyGuionVerbalNounPresenteHistoricoRule",
  "attributionFormulasTable",
  "ledFirstParagraphQueQuienCuandoDondeRule",
  "indirectQuotesNewsCommaBridgeReviewB1Rule",
  "journalisticVocabularyBySectionTable",
  "journalisticVerbsZayavitPodcherknutOprovergnutTable",
  "registerTransformationBridgeReviewB25B211B222ThreeWayContrast",
  "fixedLexicalPairsColloquialFormalTable",
  "verbToVerbalNounTransformationBridgeReviewB222Rule",
  "kotoryClauseToParticipleTransformationBridgeReviewB29B211Rule",
  "discourseConnectorTransformationBridgeReviewB23B215Table",
  "additionalFormalRegisterVerbsTable",
  "fullSentenceTransformationPracticeTable",
  "epistemicCertaintyVsB23DebateVerbsBridgeReview",
  "epistemicCertaintyScaleTable",
  "persuasiveOpinionConstructionsTable",
  "nelzyaNePlusInfinitiveBridgeReviewB23Rule",
  "rhetoricalDevicesPersuasionTable",
  "courteousHedgingBeforeAssertionTable",
  "persuasionVocabularyTable",
  "ecologyVocabularyTable",
  "technologyVocabularyTable",
  "technologiiPluralOnlyGeneralSenseRule",
  "vybrosyOtkhodyPrirodaOkruzhayushchayaSredaContrastTable",
  "ecoTechDebateBridgeReviewB23B226StructuresTable",
  "societyPlusTechVocabularyCombinedSentenceExample",
  "rhetoricalQuestionEndsMeansDebateExample",
  "criticismVsB129BasicVocabularyBridgeReview",
  "positiveValueAdjectivesScaleTable",
  "negativeValueAdjectivesScaleTable",
  "criticismVerbsExpressionsTable",
  "criticalCommentaryFormulasTable",
  "criticismVsB24LiteraryStyleAnalysisContrast",
  "criticismBridgeReviewB23B226DebatePersuasionStructures",
  "subtextVsB216ConnotationLadderBridgeReview",
  "ironyParticlesTable",
  "ironyParticlesBridgeReviewB25DiscourseParticles",
  "myagkoGovoryaLitotesRule",
  "kakByYakobyDistancingVsKakByToNiByloContrast",
  "sarcasmVsIronyIntensityContrast",
  "hiddenEmotionsVocabularyTable",
  "trkiFourSkillsStructureTable",
  "writtenSectionFormulasBridgeReviewTable",
  "oralSectionFormulasBridgeReviewTable",
  "readingListeningStrategiesTable",
  "b2CourseSevenBlocksSummaryDiagram",
  "examDayPracticalStrategiesTable",
  "examMetaVocabularyTable",
]);

function validateSlides(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "'slides' debe ser una lista";
  for (let i = 0; i < value.length; i++) {
    const s = value[i] as Record<string, unknown>;
    if (typeof s !== "object" || s === null) return `slides[${i}] debe ser un objeto`;
    if (typeof s.id !== "string" || !s.id) return `slides[${i}].id falta`;
    if (typeof s.icon !== "string" || !SLIDE_ICON_KEYS.has(s.icon))
      return `slides[${i}].icon debe ser uno de: ${[...SLIDE_ICON_KEYS].join(", ")}`;
    if (typeof s.title !== "string" || !s.title) return `slides[${i}].title falta`;
    if (!isStringArray(s.body) || s.body.length === 0)
      return `slides[${i}].body debe ser una lista de textos`;
    if (s.highlights !== undefined && !isStringArray(s.highlights))
      return `slides[${i}].highlights debe ser una lista de textos`;
    if (s.audioExamples !== undefined) {
      if (!Array.isArray(s.audioExamples)) return `slides[${i}].audioExamples debe ser una lista`;
      for (let ai = 0; ai < s.audioExamples.length; ai++) {
        const example = s.audioExamples[ai] as Record<string, unknown>;
        if (typeof example !== "object" || example === null || typeof example.text !== "string" || !example.text)
          return `slides[${i}].audioExamples[${ai}].text falta`;
        if (example.caption !== undefined && typeof example.caption !== "string")
          return `slides[${i}].audioExamples[${ai}].caption debe ser texto`;
      }
    }
  }
  return null;
}

function validateAlphabet(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "'alphabet' debe ser una lista";
  for (let i = 0; i < value.length; i++) {
    const item = value[i] as Record<string, unknown>;
    if (typeof item !== "object" || item === null) return `alphabet[${i}] debe ser un objeto`;
    if (typeof item.letter !== "string" || !item.letter) return `alphabet[${i}].letter falta`;
    if (typeof item.name !== "string" || !item.name) return `alphabet[${i}].name falta`;
    if (typeof item.transcription !== "string" || !item.transcription)
      return `alphabet[${i}].transcription falta`;
    if (item.type !== "vowel" && item.type !== "consonant" && item.type !== "sign")
      return `alphabet[${i}].type debe ser vowel, consonant o sign`;
    if (typeof item.pronunciation !== "string" || !item.pronunciation)
      return `alphabet[${i}].pronunciation falta`;
  }
  return null;
}

function validateReadingPractice(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "object" || value === null) return "'readingPractice' debe ser un objeto";
  const rp = value as Record<string, unknown>;
  if (typeof rp.title !== "string" || !rp.title) return "'readingPractice.title' falta";
  if (!Array.isArray(rp.items) || rp.items.length === 0)
    return "'readingPractice.items' debe tener al menos un elemento";
  const bad = rp.items.some(
    (item) =>
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).text !== "string" ||
      !(item as Record<string, unknown>).text
  );
  if (bad) return "cada elemento de 'readingPractice.items' necesita 'text' (texto)";
  return null;
}

function validateGrammarExamples(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "'grammar.examples' debe ser una lista";
  const bad = value.some(
    (item) =>
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).russian !== "string" ||
      !(item as Record<string, unknown>).russian ||
      typeof (item as Record<string, unknown>).translation !== "string"
  );
  if (bad) return "cada elemento de 'grammar.examples' necesita russian y translation (texto)";
  return null;
}

export function validateLessonContent(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null) {
    return { valid: false, error: "El contenido debe ser un objeto JSON" };
  }
  const v = value as Record<string, unknown>;

  if (v.videoUrl !== undefined && typeof v.videoUrl !== "string") {
    return { valid: false, error: "'videoUrl' debe ser texto" };
  }

  const grammar = v.grammar as Record<string, unknown> | undefined;
  if (typeof grammar !== "object" || grammar === null) {
    return { valid: false, error: "Falta 'grammar'" };
  }
  if (typeof grammar.title !== "string" || !grammar.title) {
    return { valid: false, error: "'grammar.title' falta o no es texto" };
  }
  if (!isStringArray(grammar.paragraphs) || grammar.paragraphs.length === 0) {
    return { valid: false, error: "'grammar.paragraphs' debe ser una lista de textos" };
  }
  const examplesError = validateGrammarExamples(grammar.examples);
  if (examplesError) return { valid: false, error: examplesError };

  const alphabetError = validateAlphabet(v.alphabet);
  if (alphabetError) return { valid: false, error: alphabetError };

  const slidesError = validateSlides(v.slides);
  if (slidesError) return { valid: false, error: slidesError };

  const readingPracticeError = validateReadingPractice(v.readingPractice);
  if (readingPracticeError) return { valid: false, error: readingPracticeError };

  if (!Array.isArray(v.vocabulary)) {
    return { valid: false, error: "'vocabulary' debe ser una lista" };
  }
  const badVocab = v.vocabulary.some(
    (item) =>
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).word !== "string" ||
      typeof (item as Record<string, unknown>).transcription !== "string" ||
      typeof (item as Record<string, unknown>).translation !== "string"
  );
  if (badVocab) {
    return {
      valid: false,
      error: "Cada elemento de 'vocabulary' necesita word, transcription y translation (texto)",
    };
  }

  if (!Array.isArray(v.exercises) || v.exercises.length === 0) {
    return { valid: false, error: "'exercises' debe tener al menos un ejercicio" };
  }
  for (let i = 0; i < v.exercises.length; i++) {
    const error = validateExercise(v.exercises[i], i);
    if (error) return { valid: false, error };
  }

  return { valid: true, content: value as LessonContent };
}
