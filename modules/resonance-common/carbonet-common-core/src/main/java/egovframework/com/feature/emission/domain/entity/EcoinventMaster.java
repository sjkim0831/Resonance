package egovframework.com.feature.emission.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "ecoinvent_master")
@Getter
@Setter
public class EcoinventMaster {

    @Id
    private Long id;

    @Column(name = "material_name", nullable = false)
    private String materialName;

    @Column(name = "activity_name", length = 1000)
    private String activityName;

    @Column(name = "activity_type")
    private String activityType;

    @Column(name = "product_name", length = 1000)
    private String productName;

    @Column(name = "geography", length = 120)
    private String geography;

    @Column(name = "reference_product_unit", length = 120)
    private String referenceProductUnit;

    @Column(name = "time_period")
    private String timePeriod;

    @Column(name = "indicator_id")
    private Long indicatorId;

    @Column(name = "indicator_name", length = 1000)
    private String indicatorName;

    @Column(name = "impact_score", nullable = false)
    private Double impactScore;

    @Column(name = "unit", nullable = false)
    private String unit;

    @Column(name = "score_unit", length = 120)
    private String scoreUnit;

    @Column(name = "version")
    private String version;

    @Column(name = "last_sync_date")
    @CreationTimestamp
    private LocalDateTime lastSyncDate;
}
