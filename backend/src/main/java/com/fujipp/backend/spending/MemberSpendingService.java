package com.fujipp.backend.spending;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
@Service public class MemberSpendingService {
    private final MemberSpendingRepository repository;
    public MemberSpendingService(MemberSpendingRepository repository){this.repository=repository;}
    @Transactional public MemberSpendingRepository.Entry add(UUID botId,String memberId,long delta){return repository.add(botId,memberId,delta);}
    @Transactional public MemberSpendingRepository.Entry set(UUID botId,String memberId,Long amount,Integer count){return repository.set(botId,memberId,amount,count);}
    @Transactional(readOnly=true) public MemberSpendingRepository.Entry get(UUID botId,String memberId){return repository.get(botId,memberId);}
    @Transactional public boolean remove(UUID botId,String memberId){return repository.remove(botId,memberId);}
    @Transactional(readOnly=true) public List<MemberSpendingRepository.Entry> leaderboard(UUID botId,int limit){return repository.leaderboard(botId,Math.max(1,Math.min(limit,1000)));}
    @Transactional(readOnly=true) public MemberSpendingRepository.Totals totals(UUID botId){return repository.totals(botId);}
}
