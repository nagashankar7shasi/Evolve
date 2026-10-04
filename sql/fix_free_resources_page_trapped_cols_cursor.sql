-- ============================================================================
--  The "Free Resources" page (custom_pages.id = 'p_1791051251097') was built entirely with
--  the Word Page Editor's 2-column block before either of the two JS fixes for the "cursor
--  stuck inside columns" bug landed (js/08_word_page_creator.js), so its saved HTML had both
--  bugs baked directly into the stored content:
--
--   1. Leading invalid nesting `<p><p><br></p></p>` right before the columns block -- the old
--      execCommand insertion-order bug (fixed going forward in the "cursor stuck inside
--      columns" PR).
--   2. The columns block was the LAST thing on the page, and two blank paragraphs the admin
--      created by pressing Enter were trapped INSIDE the right column (inside its own closing
--      </div>) instead of being siblings after the whole block -- which is exactly why the
--      cursor could never reach a line below the columns, no matter what the live JS now does
--      for *new* Enter presses: the already-saved markup itself had no paragraph after the
--      block at all. Fixing the editor's JS only prevents the bug for future edits -- it can't
--      retroactively repair bytes already sitting in this row.
--
--  This migration repairs the already-saved structure in place (content only, nothing else
--  touched):
--    - Collapses the invalid leading `<p><p><br></p></p>` to a single valid `<p><br></p>`.
--    - Moves the two trapped trailing paragraphs from inside the right column's closing </div>
--      to right after the whole block's closing </div>, so there's now a real, reachable line
--      below the columns -- matching what the editor now produces for new content going
--      forward.
--
--  Verified live before this ran: both the leading pattern and the trailing-trapped pattern
--  matched exactly once each (regex check), content length 270251 characters. Verified again
--  after: both old patterns gone, both new (fixed) patterns present exactly once, content
--  length changed by exactly -7 characters (precisely accounted for by the leading-pattern
--  cleanup: `<p><p><br></p></p>` is 18 chars, `<p><br></p>` is 11 -- the trailing move was a
--  pure reorder with zero net length change), and both embedded resource cards' titles and
--  target-ids (doc_1791084697226, doc_1791084633345) spot-checked unchanged.
-- ============================================================================

UPDATE public.custom_pages
SET content = regexp_replace(
  regexp_replace(content, '^<p><p><br></p></p>', '<p><br></p>'),
  '<p><br></p><p></p></div></div>$', '</div></div><p><br></p><p></p>'
)
WHERE id = 'p_1791051251097';
