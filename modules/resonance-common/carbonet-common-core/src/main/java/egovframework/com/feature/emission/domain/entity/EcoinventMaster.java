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
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String materialName;

    @Column(nullable = false)
    private Double impactScore;

    @Column(nullable = false)
    private String unit;

    @Column
    private String version;

    @CreationTimestamp
    private LocalDateTime lastSyncDate;
}
