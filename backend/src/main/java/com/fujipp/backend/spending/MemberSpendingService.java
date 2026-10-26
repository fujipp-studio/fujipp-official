package com.fujipp.backend.spending;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
@Service public class MemberSpendingService {
    private final MemberSpendingRepository repository;
    public MemberSpendingService(MemberSpendingRepository repository){this.repository=repository;}
    @Transactional public MemberSpendingRepository.Entry add(UUID botId,String memberId,long delta,String key){return repository.add(botId,memberId,delta,key);}
    @Transactional public MemberSpendingRepository.Entry set(UUID botId,String memberId,Long amount,Integer count,String key){return repository.set(botId,memberId,amount,count,key);}
    @Transactional(readOnly=true) public MemberSpendingRepository.Entry get(UUID botId,String memberId,String month){return repository.get(botId,memberId,month(month));}
    @Transactional public boolean remove(UUID botId,String memberId,String key){return repository.remove(botId,memberId,key);}
    @Transactional(readOnly=true) public List<MemberSpendingRepository.Entry> leaderboard(UUID botId,int limit,String month){return repository.leaderboard(botId,Math.max(1,Math.min(limit,1000)),month(month));}
    @Transactional(readOnly=true) public MemberSpendingRepository.Totals totals(UUID botId,String month){return repository.totals(botId,month(month));}
    private LocalDate month(String value){return value==null?null:YearMonth.parse(value).atDay(1);}
}
