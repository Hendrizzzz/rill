package com.rill.typing.result;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TypingResultRepository extends JpaRepository<TypingResultEntity, UUID> {

    Optional<TypingResultEntity> findByUserIdAndClientResultId(
            UUID userId, UUID clientResultId);

    List<TypingResultEntity> findAllByUserIdOrderByCompletedAtDescIdDesc(
            UUID userId, Pageable pageable);

    @Query(
            """
            select result from TypingResultEntity result
            where result.user.id = :userId
              and (
                result.completedAt < :completedAt
                or (result.completedAt = :completedAt and result.id < :id)
              )
            order by result.completedAt desc, result.id desc
            """)
    List<TypingResultEntity> findPageAfter(
            UUID userId, Instant completedAt, UUID id, Pageable pageable);

    List<TypingResultEntity> findAllByUserIdOrderByCompletedAtAscIdAsc(
            UUID userId, Pageable pageable);

    List<TypingResultEntity> findAllByUserIdOrderByCompletedAtDescIdDesc(UUID userId);

    long countByUserId(UUID userId);

    @Query("select coalesce(sum(result.durationMs), 0) from TypingResultEntity result where result.user.id = :userId")
    long totalPracticeMsByUserId(UUID userId);

    @Query("select max(result.wpm) from TypingResultEntity result where result.user.id = :userId")
    Optional<java.math.BigDecimal> highestWpmByUserId(UUID userId);

    @Query("select avg(result.accuracy) from TypingResultEntity result where result.user.id = :userId")
    Optional<Double> averageAccuracyByUserId(UUID userId);

    @Query(
            value =
                    """
                    select distinct on (
                        mode, mode_value, punctuation, numbers,
                        content_type, language, code_language,
                        word_list_version, error_policy
                    ) *
                    from typing_result
                    where user_id = :userId
                    order by mode, mode_value, punctuation, numbers,
                             content_type, language, code_language,
                             word_list_version, error_policy,
                             wpm desc, accuracy desc, completed_at asc, id asc
                    """,
            nativeQuery = true)
    List<TypingResultEntity> findPersonalRecordsByUserId(UUID userId);

}
