-- ============================================================================
--  Fix: 4 "match the following" PYQ questions in paper_1791093792896 had
--  scrambled/garbled question text (qids 3, 8, 13, 38) -- a classic symptom
--  of naive multi-column PDF text extraction reading left-to-right across
--  the page instead of column-by-column, and/or multi-word List I items
--  wrapping onto a second line and getting misattributed to the wrong column
--  mid-read. For example qid 8 read (before this fix):
--    "List II (Wildlife Sanctuary) A. Chinkara I. Ranebennur List I (Animal)
--     B. Blackbuck II. Daroji C. Four-horned III. Rangayyanadurga Antelope
--     D. Sloth Bear IV. Yadahalli ..."
--  -- note "Four-horned" and "Antelope" (one List I item) got split apart by
--  the interleaved List II text in between.
--
--  Confirmed via direct query before touching anything: options_en and
--  correct were entered correctly for all 4 questions -- only the q_en (and,
--  less severely, q_kn) question-stem TEXT was scrambled. q_kn was actually
--  already clean/unscrambled (typed in separately, not PDF-extracted) and
--  was used as the structural reference (item order, List I/II membership)
--  to reconstruct a correct q_en for each question.
--
--  Paired app-code fix (same PR as this file): a shared `renderQuestionTextHtml()`
--  helper (js/02_pricing_master_storage.js) now renders any run of consecutive
--  "List I item | List II item" pipe-delimited lines as a real two-column
--  HTML table, applied everywhere a question is shown to a reader (exam
--  engine, Practice Mode, the review modal, the printable PDF result sheet,
--  and Studio's own preview) -- see PR for the full set of touch points. This
--  file rewrites q_en/q_kn for the 4 affected questions to use that `|`
--  convention instead of the old unstructured run-on text, on top of fixing
--  the actual scrambling. Where List I and List II are of unequal length
--  (qid 13: 4 items vs 5), the extra List II item gets its own table row
--  with an empty List I cell, matching how the original exam paper would
--  have shown an unequal-length two-column list.
--
--  Verified before: all 4 ids present with their original (scrambled) q_en.
--  Verified after: all 4 ids present, q_en/q_kn rewritten and readable, and
--  options_en/correct on every one of the 4 are byte-for-byte unchanged
--  (confirmed via direct re-query) -- this migration only ever touches the
--  q_en/q_kn fields. Paper's question count unchanged (100).
-- ============================================================================

UPDATE public.tests_catalog t
SET questions = sub.new_questions
FROM (
  SELECT id, jsonb_agg(
    CASE
      WHEN (elem->>'id')::int = 3 THEN jsonb_set(
        jsonb_set(elem, '{q_en}', to_jsonb($q3en$Match the following coal deposit locations (List I) with their countries (List II):
List I (Coal Deposit Location) | List II (Country)
A. Sichuan | I. U.S.A.
B. Pennsylvania | II. China
C. Kizel | III. Australia
D. Ipswich | IV. India
E. Talcher | V. Russia
Select the code for the correct answer from the options given below:$q3en$::text)),
        '{q_kn}', to_jsonb($q3kn$ಪಟ್ಟಿ I (ಕಲ್ಲಿದ್ದಲು ನಿಕ್ಷೇಪ ಸ್ಥಾನಗಳನ್ನು) ಮತ್ತು ಪಟ್ಟಿ II (ದೇಶಗಳೊಡನೆ) ವನ್ನು ಹೊಂದಿಸಿ :
ಪಟ್ಟಿ I | ಪಟ್ಟಿ II
A. ಸಿಚುಆನ | I. ಯು.ಎಸ್.ಎ.
B. ಪೆನ್ಸಿಲ್ವೇನಿಯಾ | II. ಚೀನಾ
C. ಕಿಜೆಲ್ | III. ಆಸ್ಟ್ರೇಲಿಯಾ
D. ಇಪ್ಸ್ವಿಚ್ | IV. ಭಾರತ
E. ತಲ್ವೆರ್ | V. ರಷ್ಯಾ
ಸಂಕೇತಗಳ ಸಹಾಯದಿಂದ ಸರಿ ಉತ್ತರಗಳನ್ನು ಆರಿಸಿ :$q3kn$::text)
      )
      WHEN (elem->>'id')::int = 8 THEN jsonb_set(
        jsonb_set(elem, '{q_en}', to_jsonb($q8en$Match the following animals (List I) with their wildlife sanctuaries (List II):
List I (Animal) | List II (Wildlife Sanctuary)
A. Chinkara | I. Ranebennur
B. Blackbuck | II. Daroji
C. Four-horned Antelope | III. Rangayyanadurga
D. Sloth Bear | IV. Yadahalli
Select the code for the correct answer from the options given below:$q8en$::text)),
        '{q_kn}', to_jsonb($q8kn$ಪಟ್ಟಿ I ರಲ್ಲಿನ ವನ್ಯಜೀವಿಗಳನ್ನು ಅವುಗಳ ತತ್ಸಂಬಂಧಿ ವನ್ಯಜೀವಿ ಧಾಮ ಗಳೊಡನೆ (ಪಟ್ಟಿ II) ಹೊಂದಿಸಿ :
ಪಟ್ಟಿ I (ವನ್ಯಜೀವಿ) | ಪಟ್ಟಿ II (ವನ್ಯಜೀವಿ ಧಾಮ)
A. ಚಿಂಕಾರ | I. ರಾಣಿಬೆನ್ನೂರು
B. ಬ್ಲಾಕ್‌ಬಕ್ | II. ದರೋಜಿ
C. ನಾಲ್ಕು ಕೊಂಬಿನ ಆಂಟೆಲೋಪ್ (ಹುಲ್ಲೆ) | III. ರಂಗಯ್ಯನದುರ್ಗ
D. ಸ್ಲಾತ್ ಬೇರ್ (ಕರಡಿ) | IV. ಯಡಹಳ್ಳಿ
ಸಂಕೇತಗಳ ಸಹಾಯದಿಂದ ಸರಿ ಉತ್ತರಗಳನ್ನು ಆರಿಸಿ :$q8kn$::text)
      )
      WHEN (elem->>'id')::int = 13 THEN jsonb_set(
        jsonb_set(elem, '{q_en}', to_jsonb($q13en$Match the following items of List I with List II:
List I | List II
A. Third Schedule | I. Allocation of seats in Upper House
B. Eighth Schedule | II. Disqualification on grounds of defection
C. Fourth Schedule | III. Validation of certain acts
D. Tenth Schedule | IV. Official Languages of the Republic of India
| V. Forms of oaths and affirmations
Select the code for the correct answer from the options given below:$q13en$::text)),
        '{q_kn}', to_jsonb($q13kn$ಪಟ್ಟಿ I ಮತ್ತು ಪಟ್ಟಿ II ನ್ನು ಸಂಕೇತಾಧಾರಿತವಾಗಿ ಹೊಂದಿಸಿ :
ಪಟ್ಟಿ I | ಪಟ್ಟಿ II
A. ಮೂರನೇ ಪರಿಶಿಷ್ಟ | I. ಮೇಲ್ಮನೆಯಲ್ಲಿ ಸ್ಥಾನಗಳ ಹಂಚಿಕೆ
B. ಎಂಟನೇ ಪರಿಶಿಷ್ಟ | II. ಪಕ್ಷಾಂತರ ಆಧಾರದ ಮೇಲೆ ಅನರ್ಹತೆ
C. ನಾಲ್ಕನೇ ಪರಿಶಿಷ್ಟ | III. ಕೆಲವು ಕಾಯ್ದೆಗಳ ಸಕ್ರಮೀಕರಣ
D. ಹತ್ತನೇ ಪರಿಶಿಷ್ಟ | IV. ಗಣತಂತ್ರ ಭಾರತದ ಅಧಿಕೃತ ಭಾಷೆಗಳು
| V. ಪ್ರಮಾಣಗಳು ಮತ್ತು ದೃಢೀಕರಣದ ರೂಪಗಳು
ಸಂಕೇತಗಳ ಸಹಾಯದಿಂದ ಸರಿ ಉತ್ತರಗಳನ್ನು ಆರಿಸಿ :$q13kn$::text)
      )
      WHEN (elem->>'id')::int = 38 THEN jsonb_set(
        jsonb_set(elem, '{q_en}', to_jsonb($q38en$Match the following Committees (List I) with their Chairmen (List II):
List I (Committee) | List II (Chairman)
A. Committee on Civil Service Reforms | I. P.C. Hota
B. Committee on Police Reforms | II. Rajinder Sachar
C. Committee on Status of Muslims | III. Naresh Chandra
D. Committee on Corporate Governance | IV. Soli Sorabjee
Select the code for the correct answer from the options given below:$q38en$::text)),
        '{q_kn}', to_jsonb($q38kn$ಈ ಕೆಳಗಿನ ಸಮಿತಿಗಳನ್ನು (ಪಟ್ಟಿ I) ಮತ್ತು ಅದರ ಅಧ್ಯಕ್ಷರನ್ನು (ಪಟ್ಟಿ II) ಹೊಂದಿಸಿ ಬರೆಯಿರಿ :
ಪಟ್ಟಿ I (ಸಮಿತಿ) | ಪಟ್ಟಿ II (ಅಧ್ಯಕ್ಷರು)
A. ನಾಗರಿಕ ಸೇವಾ ಸುಧಾರಣಾ ಸಮಿತಿ | I. ಪಿ.ಸಿ. ಹೊಟಾ
B. ಪೊಲೀಸು ಸುಧಾರಣಾ ಸಮಿತಿ | II. ರಾಜಿಂದರ್ ಸಚಾರ್
C. ಮುಸಲ್ಮಾನ ಸ್ಥಾನಮಾನ ಸಮಿತಿ | III. ನರೇಶ್ ಚಂದ್ರ
D. ಕಾರ್ಪೊರೇಟ್ ಆಳ್ವಿಕೆ ಸಮಿತಿ | IV. ಸೋಲಿ ಸೊರಾಬ್ಜಿ
ಸಂಕೇತಗಳ ಸಹಾಯದಿಂದ ಸರಿ ಉತ್ತರಗಳನ್ನು ಆರಿಸಿ :$q38kn$::text)
      )
      ELSE elem
    END
    ORDER BY ord
  ) AS new_questions
  FROM public.tests_catalog, jsonb_array_elements(questions) WITH ORDINALITY AS arr(elem, ord)
  WHERE id = 'paper_1791093792896'
  GROUP BY id
) sub
WHERE t.id = sub.id;
