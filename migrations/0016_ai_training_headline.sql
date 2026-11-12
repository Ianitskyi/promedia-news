UPDATE articles SET title = 'ГО «ПроМедіа» провела навчання з ШІ та автоматизації для журналістів та активістів', updated_at = datetime('now')
WHERE slug = 'promedia-provela-navchannia-zi-shtuchnoho-intelektu-ta-avtomatyzatsii-dlia-zhurn'
  AND instr(title, 'навчання зі штучного інтелекту та автоматизації') > 0;
