-- NeoTicket - Fix feed visibility: publish existing draft events
-- Context: home feed displays only events with status = 'published'

update events
set status = 'published'
where status = 'draft';
