package com.fujipp.backend.topup;

import com.fujipp.backend.pagination.CursorCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TopupServiceTests {
    @Mock TopupRepository repository;
    @Mock SlipOkClient slipOk;
    @Mock CursorCodec cursors;
    private final PromptPayQrGenerator promptPayQr=new PromptPayQrGenerator();
    private TopupService service;
    private UUID userId;

    @BeforeEach
    void setUp() {
        service=new TopupService(repository,slipOk,promptPayQr,cursors,"0812345678","FUJIPP",1000,10000000,5242880,15);
        userId=UUID.randomUUID();
    }

    @Test
    void createsOwnedPromptPayInvoiceInSatang() {
        TopupRepository.Invoice invoice=invoice("PENDING",5000,0);
        when(repository.create(eq(userId),eq(5000L),eq("topup:test-1"),isNull(),anyString(),eq(15))).thenReturn(invoice);

        TopupResponses.Invoice response=service.create(userId.toString(),new TopupRequests.Create(5000,"topup:test-1",null));

        assertEquals(5000,response.amountSatang());
        assertEquals("FUJIPP",response.promptPayAccountName());
        verify(repository).create(eq(userId),eq(5000L),eq("topup:test-1"),isNull(),
                startsWith("00020101021229370016A00000067701011101130066812345678"),eq(15));
    }

    @Test
    void linksTheExistingTopupFlowToAPendingDonation() {
        UUID donationId=UUID.randomUUID();
        TopupRepository.Invoice invoice=invoice("PENDING",5000,0);
        when(repository.create(eq(userId),eq(5000L),eq("topup:donation"),eq(donationId),anyString(),eq(15)))
                .thenReturn(invoice);

        service.create(userId.toString(),new TopupRequests.Create(5000,"topup:donation",donationId));

        verify(repository).create(eq(userId),eq(5000L),eq("topup:donation"),eq(donationId),
                anyString(),eq(15));
    }

    @Test
    void rejectsAmountOutsideConfiguredRange() {
        TopupException exception=assertThrows(TopupException.class,
                () -> service.create(userId.toString(),new TopupRequests.Create(999,"topup:test-2",null)));
        assertEquals("INVALID_TOPUP_AMOUNT",exception.code());
    }

    @Test
    void listsOnlyTheAuthenticatedUsersTopupsWithCursorPagination() {
        TopupRepository.Invoice invoice=invoice("PENDING",5000,0);
        when(cursors.decode(null,"website-topups",userId.toString(),2)).thenReturn(List.of());
        when(repository.list(userId,null,null,3)).thenReturn(List.of(invoice));

        var page=service.list(userId.toString(),2,null);

        assertEquals(1,page.items().size());
        assertEquals(invoice.id(),page.items().getFirst().invoiceId());
        verify(repository).list(userId,null,null,3);
    }

    @Test
    void rejectsUnsupportedSlipFilesBeforeStartingVerification() {
        MockMultipartFile file=new MockMultipartFile("file","slip.pdf","application/pdf",new byte[]{1,2,3});
        TopupException exception=assertThrows(TopupException.class,() -> service.verify(userId.toString(),UUID.randomUUID(),file));
        assertEquals("INVALID_SLIP_FILE",exception.code());
    }

    @Test
    void verifiesSlipAndReturnsUpdatedBalance() {
        UUID invoiceId=UUID.randomUUID();
        TopupRepository.Invoice pending=invoice(invoiceId,"PENDING",5000,0);
        TopupRepository.Verification verification=new TopupRepository.Verification(UUID.randomUUID(),pending);
        TopupRepository.Invoice completed=invoice(invoiceId,"SUCCESS",5000,5000);
        MockMultipartFile file=new MockMultipartFile("file","slip.png","image/png",new byte[]{1,2,3});
        SlipOkClient.Result result=new SlipOkClient.Result("ref-1",OffsetDateTime.now(),"004","004","Sender","FUJIPP",5000,"{}");
        when(repository.beginVerification(eq(invoiceId),eq(userId),startsWith("sha256:"))).thenReturn(verification);
        when(slipOk.verify(any(),eq("slip.png"),any(),eq(5000L))).thenReturn(result);
        when(repository.complete(verification,result)).thenReturn(completed);

        TopupResponses.Invoice response=service.verify(userId.toString(),invoiceId,file);

        assertEquals("SUCCESS",response.status());
        assertEquals(5000,response.balanceSatang());
    }

    @Test
    void recordsRejectedSlip() {
        UUID invoiceId=UUID.randomUUID();
        TopupRepository.Invoice pending=invoice(invoiceId,"PENDING",5000,0);
        TopupRepository.Verification verification=new TopupRepository.Verification(UUID.randomUUID(),pending);
        MockMultipartFile file=new MockMultipartFile("file","slip.jpg","image/jpeg",new byte[]{1,2,3});
        when(repository.beginVerification(any(),any(),anyString())).thenReturn(verification);
        when(slipOk.verify(any(),anyString(),any(),anyLong())).thenThrow(
                new TopupException("SLIP_ALREADY_USED","used",TopupException.Kind.CONFLICT));

        assertThrows(TopupException.class,() -> service.verify(userId.toString(),invoiceId,file));
        verify(repository).reject(verification,"SLIP_ALREADY_USED","used",false);
    }

    private TopupRepository.Invoice invoice(String status,long amount,long balance) {
        return invoice(UUID.randomUUID(),status,amount,balance);
    }

    private TopupRepository.Invoice invoice(UUID id,String status,long amount,long balance) {
        return new TopupRepository.Invoice(id,"TPU_TEST",userId,amount,"THB",status,
                "https://promptpay.io/test.png",null,balance,OffsetDateTime.now().plusMinutes(15),
                "SUCCESS".equals(status)?OffsetDateTime.now():null,OffsetDateTime.now());
    }
}
