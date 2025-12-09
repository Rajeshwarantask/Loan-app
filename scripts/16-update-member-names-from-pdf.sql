-- Fix member data: member_id should be V01, V02, etc. and full_name should be actual Tamil names
-- This corrects any previous imports where names were set incorrectly

BEGIN;

-- Update all 44 members with their correct names from the PDF data
-- member_id stays as V01, V02, etc. but full_name gets the actual person's name

UPDATE profiles SET full_name = 'M.Prakasam' WHERE member_id = 'V01';
UPDATE profiles SET full_name = 'V.Karikalan' WHERE member_id = 'V02';
UPDATE profiles SET full_name = 'V.Mohan' WHERE member_id = 'V03';
UPDATE profiles SET full_name = 'R.Gunasekaran' WHERE member_id = 'V04';
UPDATE profiles SET full_name = 'S.M.Samithurai' WHERE member_id = 'V05';
UPDATE profiles SET full_name = 'V.Ilaiyaraja' WHERE member_id = 'V06';
UPDATE profiles SET full_name = 'S.Subramanian' WHERE member_id = 'V07';
UPDATE profiles SET full_name = 'V.Dinesh' WHERE member_id = 'V08';
UPDATE profiles SET full_name = 'V.Shanmugavel' WHERE member_id = 'V09';
UPDATE profiles SET full_name = 'V.Sabesh' WHERE member_id = 'V10';
UPDATE profiles SET full_name = 'M.Suresh' WHERE member_id = 'V11';
UPDATE profiles SET full_name = 'R.Prabu' WHERE member_id = 'V12';
UPDATE profiles SET full_name = 'D.Palanivel' WHERE member_id = 'V13';
UPDATE profiles SET full_name = 'R.Gopinath' WHERE member_id = 'V14';
UPDATE profiles SET full_name = 'T.Thiyagarajan' WHERE member_id = 'V15';
UPDATE profiles SET full_name = 'A.Umeshwaran' WHERE member_id = 'V16';
UPDATE profiles SET full_name = 'R.Madhan Kumar' WHERE member_id = 'V17';
UPDATE profiles SET full_name = 'R.Palaguru' WHERE member_id = 'V18';
UPDATE profiles SET full_name = 'D.Maniyarasan' WHERE member_id = 'V19';
UPDATE profiles SET full_name = 'C.Sudeshwaran' WHERE member_id = 'V20';
UPDATE profiles SET full_name = 'D.Murugesan' WHERE member_id = 'V21';
UPDATE profiles SET full_name = 'J.Solairajan' WHERE member_id = 'V22';
UPDATE profiles SET full_name = 'G.Parthasarathy' WHERE member_id = 'V23';
UPDATE profiles SET full_name = 'P.Venkatasalam' WHERE member_id = 'V24';
UPDATE profiles SET full_name = 'P.Kalaivanan' WHERE member_id = 'V25';
UPDATE profiles SET full_name = 'S.P.Selvaraj' WHERE member_id = 'V26';
UPDATE profiles SET full_name = 'V.Vijayakumar' WHERE member_id = 'V27';
UPDATE profiles SET full_name = 'J.Vijayaprakash' WHERE member_id = 'V28';
UPDATE profiles SET full_name = 'V.Veeramani' WHERE member_id = 'V29';
UPDATE profiles SET full_name = 'P.Rajini' WHERE member_id = 'V30';
UPDATE profiles SET full_name = 'S.Sridhar' WHERE member_id = 'V31';
UPDATE profiles SET full_name = 'S.Ravichandran' WHERE member_id = 'V32';
UPDATE profiles SET full_name = 'M.R.Murugesh' WHERE member_id = 'V33';
UPDATE profiles SET full_name = 'J.Rajesh' WHERE member_id = 'V34';
UPDATE profiles SET full_name = 'R.Saroj' WHERE member_id = 'V35';
UPDATE profiles SET full_name = 'C.Prakash' WHERE member_id = 'V36';
UPDATE profiles SET full_name = 'B.Veerasekaran' WHERE member_id = 'V37';
UPDATE profiles SET full_name = 'B.Viswanathan' WHERE member_id = 'V38';
UPDATE profiles SET full_name = 'S.Kandasamy' WHERE member_id = 'V39';
UPDATE profiles SET full_name = 'S.Ilangovan' WHERE member_id = 'V40';
UPDATE profiles SET full_name = 'J.Manikandan' WHERE member_id = 'V41';
UPDATE profiles SET full_name = 'E.Parthiban' WHERE member_id = 'V42';
UPDATE profiles SET full_name = 'V.Arivazhagan' WHERE member_id = 'V43';
UPDATE profiles SET full_name = 'P.Peramaian' WHERE member_id = 'V44';

COMMIT;

-- Verification query
SELECT 
    member_id,
    full_name,
    monthly_subscription,
    email
FROM profiles
WHERE member_id SIMILAR TO 'V[0-9]{2}'
ORDER BY member_id;
